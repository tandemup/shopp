import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import { I18nText as Text, useI18n } from "@/src/i18n";
import StoreMapPreview from "@/src/components/features/maps/StoreMapPreview";
import { getValidCoords } from "@/src/utils/maps/getValidCoords";
import { openGoogleMaps, openGoogleMapsSearch } from "@/src/utils/maps/openGoogleMaps";
import { nodeStoresApi } from "@/src/api/providers/node/stores";
import { DEFAULT_PRODUCT_SEARCH_TYPE, PRODUCT_SEARCH_TYPES } from "@/src/constants/productSearchTypes";
import { openSearchEngine } from "@/src/constants/searchEngines";
import { getSearchSettings } from "@/src/storage/settingsStorage";
import { nodeScanHistoryApi } from "@/src/api/providers/node/scanHistory";

export function UtilityCard({ icon, title, subtitle, onPress, disabled }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.card}>
      <View style={styles.icon}><Ionicons name={icon} size={24} color="#172033" /></View>
      <View style={styles.copy}>
        <Text style={styles.label}>{title}</Text>
        {subtitle ? <Text style={styles.description}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={19} color="#64748b" />
    </Pressable>
  );
}

async function readTransfer(format, key) {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain"], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const text = Platform.OS === "web"
    ? await (asset.file ? asset.file.text() : fetch(asset.uri).then(response => response.text()))
    : await FileSystem.readAsStringAsync(asset.uri);
  const parsed = JSON.parse(text);
  const entries = parsed?.data?.[key];
  if (parsed?.format !== format || parsed.version !== 1 || !Array.isArray(entries)) {
    throw new Error("El archivo no tiene el formato JSON de Shopp esperado.");
  }
  return entries;
}

async function exportTransfer(format, key, entries) {
  const name = format + ".json";
  const content = JSON.stringify({ app: "Shopp", format, version: 1, data: { [key]: entries } }, null, 2);
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (Platform.OS === "android") {
    const folder = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!folder.granted) return;
    const uri = await FileSystem.StorageAccessFramework.createFileAsync(folder.directoryUri, name, "application/json");
    await FileSystem.writeAsStringAsync(uri, content);
  } else {
    const uri = FileSystem.cacheDirectory + name;
    await FileSystem.writeAsStringAsync(uri, content);
    await Share.share({ title: name, url: uri });
  }
}

function UtilityHeader({ title, subtitle, onImport, onExport, busy }) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.description}>{subtitle}</Text></View>
      {onImport && (
        <View style={styles.row}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onImport} style={styles.button}><Text style={styles.buttonText}>Importar JSON</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onExport} style={styles.button}><Text style={styles.buttonText}>Exportar JSON</Text></Pressable>
        </View>
      )}
    </View>
  );
}

function distance(a, b) {
  const radians = Math.PI / 180;
  const lat = (b.lat - a.lat) * radians;
  const lng = (b.lng - a.lng) * radians;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(lng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}

const storeViews = [
  ["browse", "storefront-outline", "Explorar tiendas", "Buscar tiendas por nombre o localidad"],
  ["favorites", "star-outline", "Tiendas favoritas", "Acceso rápido a tus tiendas habituales"],
  ["nearby", "map-outline", "Tiendas cercanas", "Ordenadas por distancia"],
  ["info", "information-circle-outline", "Información de tiendas", "Direcciones y ubicación"],
  ["request", "add-circle-outline", "Proponer una tienda", "Enviar una tienda para su revisión"],
];
const emptyStore = { name: "", address: "", city: "", provincia: "", zipcode: "" };

function NodeStoreDetail({ store, storeError, onBack, toggleFavorite }) {
  const [showMap, setShowMap] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const coords = getValidCoords(store);
  const address = [...new Set([store.address, store.city, store.provincia].filter(Boolean))].join(", ");

  const saveFavorite = async () => {
    setSavingFavorite(true);
    try {
      await toggleFavorite(store);
    } finally {
      setSavingFavorite(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.detailHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver al listado" onPress={onBack} style={styles.detailIcon}>
          <Ionicons name="arrow-back" size={24} color="#172033" />
        </Pressable>
        <Text style={styles.label}>Detalle de tienda</Text>
        <View style={styles.detailIcon} />
      </View>
      <View style={styles.detailHeading}>
        <Text style={styles.detailName}>{store.name}</Text>
        <Pressable accessibilityRole="button"
          accessibilityLabel={store.favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
          accessibilityState={{ selected: Boolean(store.favorite), disabled: savingFavorite }}
          disabled={savingFavorite} onPress={saveFavorite} style={styles.detailIcon}>
          <Ionicons name={store.favorite ? "star" : "star-outline"} size={27} color={store.favorite ? "#eab308" : "#64748b"} />
        </Pressable>
      </View>
      {storeError ? <Text accessibilityLiveRegion="polite" style={styles.description}>{storeError}</Text> : null}
      <View>
        <Text style={styles.label}>Dirección</Text>
        <Text style={styles.description}>{address || "Dirección no disponible"}</Text>
      </View>
      <View style={styles.screen}>
        <Text style={styles.label}>Ubicación</Text>
        <View style={styles.detailMap}>
          {coords && showMap ? (
            <StoreMapPreview lat={coords.lat} lng={coords.lng} />
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map-outline" size={34} color="#94a3b8" />
              <Text style={styles.description}>{coords ? "Previsualización del mapa" : "Ubicación no disponible"}</Text>
            </View>
          )}
        </View>
        {coords && (
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showMap }} onPress={() => setShowMap(value => !value)} style={[styles.mapAction, styles.mapSecondary]}>
            <Ionicons name={showMap ? "close-outline" : "map-outline"} size={18} color="#1a73e8" />
            <Text style={styles.mapSecondaryText}>{showMap ? "Ocultar mapa" : "Ver mapa (OpenStreetMap)"}</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="link" onPress={() => coords
          ? openGoogleMaps({ ...coords, label: store.name })
          : openGoogleMapsSearch([store.name, address].filter(Boolean).join(" "))}
          style={[styles.mapAction, styles.mapPrimary]}>
          <Ionicons name="navigate-outline" size={18} color="#fff" />
          <Text style={styles.mapPrimaryText}>Abrir en Google Maps</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function NodeStoresUtility({ accessToken, stores, storeError, storeLoading, loadStores, toggleFavorite, isAdmin, initialPage = "home", onBackFromEntry }) {
  const [page, setPage] = useState(initialPage);
  const [detailId, setDetailId] = useState(null);
  const backToSettings = page === initialPage ? onBackFromEntry : undefined;
  const canManage = isAdmin && ["management", "catalog", "validate"].includes(page);
  const [filter, setFilter] = useState("");
  const [position, setPosition] = useState(null);
  const [draft, setDraft] = useState(emptyStore);
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try { await action(); }
    catch (error) { setMessage(error?.message || "No se pudo completar la operación."); }
    finally { setBusy(false); }
  }

  function openPage(next) {
    setMessage("");
    setFilter("");
    setSelected(null);
    setPage(next);

    if (next === "nearby") void run(async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Concede permiso de ubicación para ordenar las tiendas por distancia.");
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({ lat: coords.latitude, lng: coords.longitude });
    });
  }

  useEffect(() => {
    if (page !== "validate" || !isAdmin) return;
    let active = true;
    setBusy(true);
    setPending([]);
    nodeStoresApi.listPendingRequests(accessToken)
      .then(items => { if (active) setPending(items); })
      .catch(error => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [accessToken, isAdmin, page]);

  async function moderate(approve) {
    if (!isAdmin || !selected) return;
    let coords;
    if (approve) {
      coords = { latitude: Number(latitude), longitude: Number(longitude) };
      if (!latitude.trim() || !longitude.trim() || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)
        || Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
        setMessage("Introduce una latitud y una longitud válidas.");
        return;
      }
    }
    await run(async () => {
      if (approve) {
        await nodeStoresApi.approveRequest(accessToken, selected.id, coords);
        void loadStores();
      } else {
        await nodeStoresApi.rejectRequest(accessToken, selected.id);
      }
      setPending(current => current.filter(item => item.id !== selected.id));
      setSelected(null);
      setMessage(approve ? "Tienda publicada." : "Solicitud rechazada.");
    });
  }

  const query = filter.trim().toLocaleLowerCase();
  const visibleStores = stores.filter(store =>
    (page !== "favorites" || store.favorite) &&
    (page !== "nearby" || (position && Number.isFinite(store.location?.lat) && Number.isFinite(store.location?.lng))) &&
    [store.name, store.city, store.address].some(value => value?.toLocaleLowerCase().includes(query))
  );
  if (page === "nearby" && position) visibleStores.sort((a, b) => distance(position, a.location) - distance(position, b.location));

  const detailStore = stores.find(store => store.id === detailId);
  if (detailStore) {
    return <NodeStoreDetail key={detailStore.id} store={detailStore} storeError={storeError}
      onBack={() => setDetailId(null)} toggleFavorite={toggleFavorite} />;
  }

  return (
    <View style={styles.screen}>
      <UtilityHeader
        title={canManage
          ? { management: "Gestión de tiendas", catalog: "Catálogo de supermercados", validate: "Validar tiendas" }[page]
          : storeViews.find(([id]) => id === page)?.[2] || "Tiendas"}
        subtitle={page === "home" ? "Explora tiendas, consulta tus favoritas o busca establecimientos cercanos." : ""}
        busy={busy}
        onImport={isAdmin && (page === "home" || page === "catalog") ? () => run(async () => {
          const entries = await readTransfer("shopp-stores", "stores");
          if (!entries) return;
          const result = await nodeStoresApi.importCatalog(accessToken, entries, "merge");
          await loadStores();
          setMessage(`Catálogo importado. ${result.inserted} nuevas y ${result.updated} actualizadas.`);
        }) : undefined}
        onExport={() => run(async () => exportTransfer("shopp-stores", "stores", await nodeStoresApi.exportCatalog(accessToken)))}
      />
      {page !== "home" && (
        <UtilityCard icon="arrow-back" title={backToSettings ? "Volver a Ajustes" : canManage && page !== "management" ? "Volver a Gestión de tiendas" : "Volver a Tiendas"}
          onPress={backToSettings || (() => openPage(canManage && page !== "management" ? "management" : "home"))} disabled={busy} />
      )}
      {busy && <Text accessibilityLiveRegion="polite">Procesando…</Text>}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.description}>{message}</Text> : null}
      {page === "home" && isAdmin && (
        <UtilityCard icon="shield-checkmark-outline" title="Gestión de tiendas"
          subtitle="Revisar solicitudes y administrar el catálogo" onPress={() => openPage("management")} disabled={busy} />
      )}
      {page === "management" && isAdmin && (
        <>
          <UtilityCard icon="storefront-outline" title="Validar tiendas" subtitle="Revisar y publicar propuestas"
            onPress={() => openPage("validate")} disabled={busy} />
          <UtilityCard icon="document-text-outline" title="Catálogo de supermercados" subtitle="Importar y exportar el catálogo en JSON"
            onPress={() => openPage("catalog")} disabled={busy} />
        </>
      )}
      {page === "home" && storeViews.map(([id, icon, title, subtitle]) =>
        <UtilityCard key={id} icon={icon} title={title} subtitle={subtitle} onPress={() => openPage(id)} disabled={busy} />
      )}
      {page === "request" && (
        <View style={styles.screen}>
          {Object.entries({ name: "Nombre", address: "Dirección", city: "Localidad", provincia: "Provincia", zipcode: "Código postal" }).map(([key, label]) =>
            <TextInput key={key} accessibilityLabel={label} placeholder={label} style={styles.input} value={draft[key]} onChangeText={value => setDraft(current => ({ ...current, [key]: value }))} />
          )}
          <UtilityCard icon="send-outline" title="Enviar propuesta" disabled={busy || !draft.name.trim() || !draft.address.trim()} onPress={() => run(async () => {
            await nodeStoresApi.submitRequest(accessToken, draft);
            setDraft(emptyStore);
            setPage("home");
            setMessage("Propuesta enviada para su revisión.");
          })} />
        </View>
      )}
      {page === "validate" && isAdmin && (
        <View style={styles.screen}>
          {!pending.length && !busy && <Text>No hay propuestas pendientes.</Text>}
          {pending.map(item => (
            <UtilityCard key={item.id} icon="storefront-outline" title={item.name} subtitle={item.address} disabled={busy} onPress={() => {
              setSelected(item);
              setLatitude(String(item.latitude ?? ""));
              setLongitude(String(item.longitude ?? ""));
              setMessage("");
            }} />
          ))}
          {selected && (
            <View style={styles.screen}>
              <Text style={styles.label}>{selected.name}</Text>
              <TextInput accessibilityLabel="Latitud" placeholder="Latitud" style={styles.input} value={latitude} onChangeText={setLatitude} />
              <TextInput accessibilityLabel="Longitud" placeholder="Longitud" style={styles.input} value={longitude} onChangeText={setLongitude} />
              <UtilityCard icon="checkmark-outline" title="Validar y publicar" disabled={busy} onPress={() => moderate(true)} />
              <UtilityCard icon="close-outline" title="Rechazar propuesta" disabled={busy} onPress={() => moderate(false)} />
            </View>
          )}
        </View>
      )}
      {(["browse", "favorites", "nearby", "info"].includes(page) || (isAdmin && page === "catalog")) && (
        <View style={styles.screen}>
          <TextInput accessibilityLabel="Buscar tiendas" placeholder="Nombre, dirección o localidad" style={styles.input} value={filter} onChangeText={setFilter} />
          {storeLoading ? <Text>Cargando tiendas…</Text> : null}
          {storeError ? <UtilityCard icon="refresh-outline" title="Reintentar" subtitle={storeError} onPress={loadStores} /> : null}
          {!storeLoading && !busy && !storeError && !visibleStores.length ? <Text>No hay tiendas que mostrar.</Text> : null}
          {visibleStores.map(store => (
            <View key={store.id} style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Ver detalle de ${store.name}`} onPress={() => setDetailId(store.id)} style={styles.copy}>
                <Text style={styles.label}>{store.name}</Text>
                <Text style={styles.description}>{[store.address, store.city, store.provincia].filter(Boolean).join(" · ")}</Text>
                {page === "nearby" && position && <Text style={styles.description}>{distance(position, store.location).toFixed(1)} km</Text>}
              </Pressable>
              {page === "info" && Number.isFinite(store.location?.lat) && Number.isFinite(store.location?.lng) && (
                <Pressable accessibilityRole="link" accessibilityLabel="Abrir ubicación en el mapa" onPress={() => run(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${store.location.lat},${store.location.lng}`))}>
                  <Ionicons name="map-outline" size={22} color="#2563eb" />
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel={store.favorite ? "Quitar de favoritas" : "Añadir a favoritas"} onPress={() => toggleFavorite(store)}>
                <Ionicons name={store.favorite ? "star" : "star-outline"} size={23} color={store.favorite ? "#b45309" : "#64748b"} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function NodeScannerUtility({ accessToken, onCamera, onLookup, hint, isAdmin, searchCode }) {
  const [history, setHistory] = useState(null);

  const [barcode, setBarcode] = useState("");
  const [type, setType] = useState(DEFAULT_PRODUCT_SEARCH_TYPE);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try { await action(); }
    catch (error) { setMessage(error?.message || "No se pudo completar la operación."); }
    finally { setBusy(false); }
  }

  return (
    <View style={styles.screen}>
      <UtilityHeader title="Escáner" subtitle="Escanea productos o tarjetas musicales con QR." busy={busy}
        onImport={() => run(async () => {
          const entries = await readTransfer("shopp-scanner-products", "products");
          if (!entries) return;
          let imported = 0;
          try {
            for (const entry of entries) {
              if (!/^\d{8,14}$/.test(String(entry?.barcode ?? ""))) throw new Error("Hay un código no válido en el archivo.");
              await nodeScanHistoryApi.sync(accessToken, entry);
              imported += 1;
            }
            setMessage(`${imported} registros importados al historial.`);
          } catch (error) {
            throw new Error(`${imported} registros importados antes del error. ${error.message}`);
          }
          if (history) setHistory(await nodeScanHistoryApi.list(accessToken, 300));
        })}
        onExport={() => run(async () => exportTransfer("shopp-scanner-products", "products", await nodeScanHistoryApi.list(accessToken, 300)))}
      />
      {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
      {!history ? (
        <>
          <UtilityCard icon="barcode-outline" title="Escanear nuevo producto" subtitle="Abre la cámara para leer un código de barras." disabled={busy} onPress={() => onCamera("barcode")} />
          <UtilityCard icon="musical-notes-outline" title="Escanear QR de música" subtitle="Abre el enlace de YouTube de la tarjeta musical." disabled={busy} onPress={() => onCamera("music")} />
          {isAdmin && (
            <View style={styles.manual}>
              <Text style={styles.label}>Introducir código manualmente</Text>
              <View style={styles.row}>
                {PRODUCT_SEARCH_TYPES.map(({ value: id, label }) =>
                  <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: id === type }} onPress={() => setType(id)} style={[styles.button, id === type && styles.selected]}>
                    <Text style={[styles.buttonText, id === type && styles.selectedText]}>{label}</Text>
                  </Pressable>
                )}
              </View>
              <TextInput accessibilityLabel="Información adicional" placeholder="Información adicional opcional" style={styles.input} value={notes} onChangeText={setNotes} />
              <TextInput accessibilityLabel="Código de barras" placeholder="Código de barras" keyboardType="numeric" style={styles.input} value={barcode} onChangeText={setBarcode} />
              <UtilityCard icon="arrow-forward" title="Continuar" disabled={busy || !barcode.trim()} onPress={() => run(() => onLookup({ data: barcode, productType: type, notes: notes.trim() }))} />
            </View>
          )}
          {hint ? <Text accessibilityLiveRegion="polite" style={styles.description}>{hint}</Text> : null}
          {searchCode ? (
            <UtilityCard icon="search-outline" title="Buscar producto en la web" subtitle={searchCode}
              disabled={busy} onPress={() => run(async () => {
                const settings = await getSearchSettings();
                await openSearchEngine(settings.selectedProductEngine || settings.generalEngine, searchCode);
              })} />
          ) : null}
          <UtilityCard icon="time-outline" title="Historial de escaneos" subtitle="Ver productos y códigos escaneados." disabled={busy} onPress={() => run(async () => setHistory(await nodeScanHistoryApi.list(accessToken, 300)))} />
        </>
      ) : (
        <>
          <UtilityCard icon="arrow-back" title="Volver al Escáner" onPress={() => setHistory(null)} disabled={busy} />
          {!history.length && <Text>No hay escaneos guardados.</Text>}
          {history.map(item => <View style={styles.card} key={item.barcode}><View style={styles.copy}><Text style={styles.label}>{item.name || "Producto sin identificar"}</Text><Text style={styles.description}>{item.barcode}{item.brand ? " · " + item.brand : ""}</Text></View></View>)}
        </>
      )}
    </View>
  );
}

export function NodeSettingsUtility({ user, onProfile, onDashboard, onStoreCatalog, onStoreRequests, onSignOut, children }) {
  const { language, setLanguage } = useI18n();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  return (
    <ScrollView style={styles.settings} contentContainerStyle={styles.settingsContent}>
      <UtilityHeader title="Ajustes" subtitle="Cuenta y configuración de Shopp" />
      <View style={styles.card}><View style={styles.icon}><Ionicons name="person-outline" size={24} color="#2563eb" /></View><View style={styles.copy}><Text style={styles.label}>{user.name || user.alias || user.email}</Text><Text style={styles.description}>{user.email}</Text></View></View>
      <UtilityCard icon="person-circle-outline" title="Mi perfil" subtitle="Editar tus datos y opciones de la cuenta" onPress={onProfile} />
      {user.role === "admin" && <UtilityCard icon="speedometer-outline" title="Panel del servidor" subtitle="Gestión de usuarios y revisión de productos" onPress={onDashboard} />}
      {user.role === "admin" && (
        <>
          <UtilityCard icon="storefront-outline" title="Peticiones de creación de tiendas" subtitle="Revisar solicitudes pendientes" onPress={onStoreRequests} />
          <UtilityCard icon="document-text-outline" title="Catálogo de supermercados" subtitle="Importar y exportar supermercados en JSON" onPress={onStoreCatalog} />
        </>
      )}
      <UtilityCard icon="language-outline" title="Idioma de la aplicación" subtitle={language === "en" ? "English · Cambiar a Español" : "Español · Cambiar a English"} onPress={() => setLanguage(language === "en" ? "es" : "en")} />
      {confirmSignOut ? (
        <View style={styles.manual}>
          <Text accessibilityLiveRegion="polite" style={styles.label}>¿Cerrar sesión?</Text>
          <UtilityCard icon="arrow-back" title="Cancelar" onPress={() => setConfirmSignOut(false)} />
          <UtilityCard icon="log-out-outline" title="Confirmar cierre de sesión"
            onPress={() => { setConfirmSignOut(false); onSignOut(); }} />
        </View>
      ) : (
        <UtilityCard icon="log-out-outline" title="Cerrar sesión" onPress={() => setConfirmSignOut(true)} />
      )}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, backgroundColor: "#fcf8ee", borderRadius: 12 },
  detailIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  detailHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailName: { flex: 1, color: "#172033", fontSize: 24, fontWeight: "800" },
  detailMap: { height: 200, borderRadius: 12, overflow: "hidden", backgroundColor: "#eef0f2" },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  mapAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: 9, padding: 8 },
  mapSecondary: { borderWidth: 1, borderColor: "#1a73e8" },
  mapSecondaryText: { color: "#1a73e8", fontWeight: "700" },
  mapPrimary: { backgroundColor: "#1769d2" },
  mapPrimaryText: { color: "#fff", fontWeight: "700" },
  settings: { flex: 1, backgroundColor: "#f4f7fc" },
  settingsContent: { width: "100%", maxWidth: 920, alignSelf: "center", padding: 22, gap: 14 },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { color: "#172033", fontSize: 29, fontWeight: "800" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, padding: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 17 },
  copy: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#eef2f6" },
  label: { color: "#172033", fontSize: 16, fontWeight: "800" },
  description: { color: "#64748b", fontSize: 14, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { padding: 10, borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 10, backgroundColor: "#eff6ff" },
  buttonText: { fontWeight: "750", color: "#1d4ed8" },
  selected: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  selectedText: { color: "#fff" },
  manual: { gap: 10, borderWidth: 1, borderColor: "#ddd6fe", borderRadius: 17, backgroundColor: "#fff", padding: 14 },
  input: { minHeight: 44, padding: 10, color: "#172033", backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10 },
});
