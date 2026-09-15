import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Platform, Share } from "react-native";
import { I18nText as Text } from "@/src/i18n";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ROUTES } from "@/src/navigation/ROUTES";
import { buildHeaderConfig } from "@/src/utils/layout/headerStyles";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { useStores } from "@/src/context/StoresContext";

const STORES_JSON_FORMAT = "shopp-stores";
const JSON_TYPES = ["application/json", "text/json", "text/plain"];

function formatExportDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeImportedStore(rawStore, index) {
  const id = String(rawStore?.id || "").trim();
  const name = String(rawStore?.name || "").trim();
  const address = String(rawStore?.address || "").trim();
  const city = String(rawStore?.city || "").trim();
  const provincia = String(rawStore?.provincia || "Asturias").trim() || "Asturias";
  const latitude = Number(rawStore?.location?.lat);
  const longitude = Number(rawStore?.location?.lng);
  const zipcode = Number(rawStore?.zipcode ?? 0);

  if (!id || !name || !address || !city) {
    throw new Error(`La tienda ${index + 1} debe tener id, nombre, dirección y ciudad.`);
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`La tienda ${name} tiene coordenadas no válidas.`);
  }

  if (!Number.isFinite(zipcode)) {
    throw new Error(`La tienda ${name} tiene un código postal no válido.`);
  }

  return {
    id,
    name,
    address,
    city,
    provincia,
    zipcode: Math.trunc(zipcode),
    location: {
      lat: latitude,
      lng: longitude,
      source: String(rawStore?.location?.source || "json_import"),
    },
    favorite: false,
  };
}

/* -------------------------------------------------
   Menu Item
-------------------------------------------------- */
function MenuItem({ icon, title, subtitle, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={28} color="#111827" />
      </View>

      <View style={styles.cardText}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>

        {subtitle ? (
          <Text style={styles.cardSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
    </Pressable>
  );
}

/* -------------------------------------------------
   Screen
-------------------------------------------------- */
export default function StoresHomeScreen() {
  const navigation = useNavigation();
  const currentUser = useQuery(api.users.current);
  const { stores } = useStores();
  const importStores = useMutation(api.stores.upsertStores);
  const [transferBusy, setTransferBusy] = useState(null);
  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === "admin";

  const exportStores = async () => {
    if (!stores.length) {
      safeAlert("No hay tiendas", "No hay tiendas disponibles para exportar.");
      return;
    }

    try {
      setTransferBusy("export");
      const filename = `shopp-tiendas-${formatExportDate()}.json`;
      const json = JSON.stringify(
        {
          app: "Shopp",
          format: STORES_JSON_FORMAT,
          version: 1,
          exportedAt: new Date().toISOString(),
          data: {
            stores: stores.map(({ favorite, _id, _creationTime, ...store }) => ({
              ...store,
              favorite: false,
            })),
          },
        },
        null,
        2,
      );

      if (Platform.OS === "web" && typeof document !== "undefined") {
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } else {
        const uri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(uri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Share.share({ title: filename, url: uri });
      }
    } catch (error) {
      safeAlert("No se pudo exportar", error?.message || "Inténtalo de nuevo.");
    } finally {
      setTransferBusy(null);
    }
  };

  const importStoresFromJson = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: JSON_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) throw new Error("No se ha podido leer el fichero seleccionado.");

      const jsonText =
        Platform.OS === "web" && asset.file
          ? await asset.file.text()
          : await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
      const payload = JSON.parse(jsonText);

      if (payload?.format && payload.format !== STORES_JSON_FORMAT) {
        throw new Error("El fichero no corresponde a una exportación de tiendas de Shopp.");
      }

      const rawStores = Array.isArray(payload)
        ? payload
        : payload?.data?.stores || payload?.stores;

      if (!Array.isArray(rawStores) || rawStores.length === 0) {
        throw new Error("El fichero no contiene tiendas para importar.");
      }

      const normalizedStores = rawStores.map(normalizeImportedStore);
      const ids = new Set();
      normalizedStores.forEach((store) => {
        if (ids.has(store.id)) {
          throw new Error(`El fichero contiene el id de tienda repetido: ${store.id}.`);
        }
        ids.add(store.id);
      });

      safeAlert(
        "Importar tiendas",
        `Se importarán o actualizarán ${normalizedStores.length} tiendas desde ${asset.name || "el fichero seleccionado"}.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Importar",
            onPress: async () => {
              try {
                setTransferBusy("import");
                const summary = await importStores({ stores: normalizedStores });
                safeAlert(
                  "Importación terminada",
                  `${summary.inserted} nuevas y ${summary.updated} actualizadas.`,
                );
              } catch (error) {
                safeAlert("No se pudo importar", error?.message || "Inténtalo de nuevo.");
              } finally {
                setTransferBusy(null);
              }
            },
          },
        ],
      );
    } catch (error) {
      safeAlert("Fichero no válido", error?.message || "Selecciona un JSON de tiendas válido.");
    }
  };

  const headerConfig = useMemo(
    () =>
      buildHeaderConfig({
        title: "Tiendas",
        preset: "light",
      }),
    [],
  );

  useEffect(() => {
    navigation.setOptions(headerConfig.navigationOptions);
  }, [navigation, headerConfig]);

  return (
    <View style={styles.screen}>
      <StatusBar {...headerConfig.statusBar} />

      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Tiendas</Text>

          <Text style={styles.subtitle}>
            Explora tiendas, consulta tus favoritas o busca establecimientos
            cercanos.
          </Text>

          {isAdmin ? (
            <View style={styles.transferSection}>
              <Text style={styles.transferTitle}>Datos de tiendas</Text>
              <View style={styles.transferRow}>
                <Pressable
                  disabled={transferBusy !== null}
                  style={({ pressed }) => [
                    styles.transferButton,
                    transferBusy !== null && styles.transferButtonDisabled,
                    pressed && transferBusy === null && styles.cardPressed,
                  ]}
                  onPress={importStoresFromJson}
                >
                  <Ionicons name="download-outline" size={18} color="#2563EB" />
                  <Text style={styles.transferText}>
                    {transferBusy === "import" ? "Importando..." : "Importar JSON"}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={transferBusy !== null}
                  style={({ pressed }) => [
                    styles.transferButton,
                    transferBusy !== null && styles.transferButtonDisabled,
                    pressed && transferBusy === null && styles.cardPressed,
                  ]}
                  onPress={exportStores}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#2563EB" />
                  <Text style={styles.transferText}>
                    {transferBusy === "export" ? "Exportando..." : "Exportar JSON"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            <MenuItem
              icon="storefront-outline"
              title="Explorar tiendas"
              subtitle="Buscar tiendas cercanas o por nombre"
              onPress={() => navigation.navigate(ROUTES.STORES_BROWSE)}
            />

            <MenuItem
              icon="star-outline"
              title="Tiendas favoritas"
              subtitle="Acceso rápido a tus tiendas habituales"
              onPress={() => navigation.navigate(ROUTES.STORES_FAVORITES)}
            />

            <MenuItem
              icon="map-outline"
              title="Tiendas cercanas"
              subtitle="Ordenadas por distancia"
              onPress={() => navigation.navigate(ROUTES.STORES_NEARBY)}
            />

            <MenuItem
              icon="information-circle-outline"
              title="Información de tiendas"
              subtitle="Horarios, direcciones y estado"
              onPress={() => navigation.navigate(ROUTES.STORE_INFO)}
            />

            <MenuItem
              icon="add-circle-outline"
              title="Proponer una tienda"
              subtitle="Envía una tienda para que la revise la administración"
              onPress={() => navigation.navigate(ROUTES.STORE_CREATION_REQUEST)}
            />

            {isAdmin ? (
              <MenuItem
                icon="shield-checkmark-outline"
                title="Validar tiendas"
                subtitle="Revisar y publicar las tiendas propuestas"
                onPress={() => navigation.navigate(ROUTES.ADMIN_STORE_REQUESTS)}
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  content: {
    flex: 1,
  },

  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 24,
  },

  transferSection: {
    marginBottom: 20,
  },

  transferTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 9,
  },

  transferRow: {
    flexDirection: "row",
    gap: 10,
  },

  transferButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  transferButtonDisabled: {
    opacity: 0.55,
  },

  transferText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "800",
  },

  actions: {
    gap: 14,
  },

  card: {
    minHeight: 86,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  cardText: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
});
