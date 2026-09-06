import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MAX_TUTORIAL_ITEMS, tutorialItemKey } from "@/convex/lib/tutorialItems";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";

const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function Action({ icon, label, onPress, disabled, primary = false }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled} onPress={onPress}
      style={[styles.action, primary && styles.primary, disabled && styles.disabled]}>
      <Ionicons name={icon} size={18} color={primary ? "#fff" : "#2563eb"} />
      <Text style={[styles.actionText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

function TutorialPane({ label, tutorials, selectedId, otherId, onChoose, clipboard, onCopy, onCut, onPaste, busy }) {
  const { width } = useWindowDimensions();
  const thumbnailStyle = [styles.thumbnail, width < 700 && styles.thumbnailSmall];
  const tutorial = tutorials.find((item) => item._id === selectedId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  useEffect(() => { setSelected([]); setQuery(""); setPickerOpen(false); }, [selectedId]);
  const tracks = tutorial?.tracks || [];
  const filtered = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return tracks.filter((track) => terms.every((term) => normalize(track.title).includes(term)));
  }, [tracks, query]);
  const validSelected = tracks.filter((track) => selected.includes(tutorialItemKey(track))).map(tutorialItemKey);
  const allVisibleSelected = filtered.length > 0 && filtered.every((track) => selected.includes(tutorialItemKey(track)));
  const toggle = (key) => setSelected((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  const toggleVisible = () => {
    const visible = filtered.map(tutorialItemKey);
    setSelected((current) => allVisibleSelected ? current.filter((key) => !visible.includes(key)) : [...new Set([...current, ...visible])]);
  };
  return (
    <View style={styles.pane}>
      <Text style={styles.paneLabel}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Elegir tutorial: ${label}`} accessibilityState={{ expanded: pickerOpen }}
        disabled={busy} onPress={() => setPickerOpen((value) => !value)} style={styles.selector}>
        <Text style={styles.selectorText} numberOfLines={2}>{tutorial?.title || "Elegir tutorial"}</Text>
        <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={20} color="#2563eb" />
      </Pressable>
      {pickerOpen ? (
        <ScrollView style={styles.picker} keyboardShouldPersistTaps="handled">
          {tutorials.map((item) => (
            <Pressable key={item._id} disabled={item._id === otherId || busy}
              accessibilityRole="button" accessibilityLabel={item.title}
              onPress={() => { onChoose(item._id); setPickerOpen(false); }}
              style={[styles.pickerItem, item._id === otherId && styles.disabled]}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.meta}>{item.tracks.length}/{MAX_TUTORIAL_ITEMS}{item._id === otherId ? " · abierta en el otro panel" : ""}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Text style={styles.meta}>{tracks.length}/{MAX_TUTORIAL_ITEMS} elementos · {validSelected.length} seleccionados</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Buscar elementos…" placeholderTextColor="#888"
        accessibilityLabel={`Buscar elementos: ${label}`} editable={!busy && Boolean(tutorial)} style={styles.search} />
      <View style={styles.toolbar}>
        <Action icon={allVisibleSelected ? "checkbox-outline" : "square-outline"} label={allVisibleSelected ? "Desmarcar" : "Seleccionar visibles"}
          disabled={busy || !filtered.length} onPress={toggleVisible} />
        <Action icon="copy-outline" label={`Copiar (${validSelected.length})`} disabled={busy || !validSelected.length}
          onPress={() => onCopy({ sourceId: tutorial._id, sourceTitle: tutorial.title, itemKeys: validSelected })} />
        <Action icon="cut-outline" label={`Cortar (${validSelected.length})`} disabled={busy || !validSelected.length}
          onPress={() => onCut({ sourceId: tutorial._id, sourceTitle: tutorial.title, itemKeys: validSelected })} />
        <Action icon="clipboard-outline" label="Pegar aquí" primary
          disabled={busy || !tutorial || !clipboard || clipboard.sourceId === tutorial._id}
          onPress={() => onPaste(tutorial)} />
      </View>
      <FlatList style={styles.items} data={filtered} keyExtractor={tutorialItemKey} keyboardShouldPersistTaps="handled"
        initialNumToRender={10} maxToRenderPerBatch={12} contentContainerStyle={styles.itemsContent}
        ListEmptyComponent={<Text style={styles.empty}>{!tutorial ? "Elige una lista de tutoriales." : query ? "No hay coincidencias." : "Esta lista no tiene elementos."}</Text>}
        renderItem={({ item }) => {
          const checked = selected.includes(tutorialItemKey(item));
          const pendingCut = clipboard?.mode === "cut" && clipboard.sourceId === tutorial?._id && clipboard.itemKeys.includes(tutorialItemKey(item));
          return (
            <Pressable accessibilityRole="checkbox" accessibilityLabel={item.title} accessibilityState={{ checked, disabled: busy }}
              disabled={busy} onPress={() => toggle(tutorialItemKey(item))} style={[styles.item, checked && styles.itemSelected, pendingCut && styles.itemCut]}>
              <Ionicons name={checked ? "checkbox" : "square-outline"} size={23} color={checked ? "#2563eb" : "#64748b"} />
              {item.videoId ? <Image source={{ uri: `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` }} style={thumbnailStyle} resizeMode="cover" />
                : <View style={[...thumbnailStyle, styles.fallback]}><Ionicons name="albums-outline" size={24} color="#2563eb" /></View>}
              <View style={styles.itemBody}>
                <Text style={styles.meta}>{item.kind === "album" ? "Serie" : "Vídeo"}{pendingCut ? " · Pendiente de mover" : ""}</Text>
                <Text style={styles.itemTitle} numberOfLines={3}>{item.title}</Text>
              </View>
            </Pressable>
          );
        }} />
    </View>
  );
}

export default function TutorialTransferScreen({ tutorials, clientId, onClose }) {
  const { width } = useWindowDimensions();
  const lists = tutorials || [];
  const [leftId, setLeftId] = useState(() => lists[0]?._id || null);
  const [rightId, setRightId] = useState(() => lists[1]?._id || null);
  const [clipboard, setClipboard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  const copyItems = useMutation(api.tutorials.copyItems);
  // The screen may open while the parent's initial query is still loading.
  useEffect(() => {
    const validLeft = lists.some((item) => item._id === leftId) ? leftId : lists[0]?._id || null;
    const validRight = lists.some((item) => item._id === rightId && item._id !== validLeft)
      ? rightId : lists.find((item) => item._id !== validLeft)?._id || null;
    if (validLeft !== leftId) setLeftId(validLeft);
    if (validRight !== rightId) setRightId(validRight);
  }, [tutorials, leftId, rightId]);
  const copy = (value) => {
    setClipboard({ ...value, mode: "copy" });
    setFailed(false);
    setStatus(`${value.itemKeys.length} elementos copiados de «${value.sourceTitle}». Pulsa «Pegar aquí» en la otra lista.`);
  };
  const cut = (value) => {
    const source = lists.find((item) => item._id === value.sourceId);
    if (!source || source.tracks.length <= value.itemKeys.length) {
      setFailed(true);
      setStatus("La lista de origen debe conservar al menos un elemento. Reduce la selección o usa Copiar.");
      return;
    }
    setClipboard({ ...value, mode: "cut" });
    setFailed(false);
    setStatus(`${value.itemKeys.length} elementos preparados para mover desde «${value.sourceTitle}». Se quitarán del origen al pegar en la otra lista.`);
  };
  const cancelCut = () => {
    setClipboard(null);
    setFailed(false);
    setStatus("Corte cancelado. Los elementos permanecen en la lista de origen.");
  };
  const paste = async (destination) => {
    if (lock.current || !clipboard || !clientId || destination._id === clipboard.sourceId) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    setStatus("");
    try {
      const result = await copyItems({ clientId, sourceId: clipboard.sourceId, destinationId: destination._id, itemKeys: clipboard.itemKeys, mode: clipboard.mode });
      if (clipboard.mode === "cut") {
        setClipboard(null);
        setStatus(`${result.moved} elementos retirados de «${clipboard.sourceTitle}». ${result.copied} añadidos a «${destination.title}» y ${result.skipped} ya estaban en el destino. Total: ${result.total}/${MAX_TUTORIAL_ITEMS}.`);
      } else setStatus(`${result.copied} elementos añadidos a «${destination.title}». ${result.skipped} duplicados omitidos. Total: ${result.total}/${MAX_TUTORIAL_ITEMS}.`);
    } catch (error) {
      setFailed(true);
      setStatus(error?.message || "No se pudo pegar. Inténtalo de nuevo.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const close = () => { if (!lock.current) onClose(); };
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headingBody}>
            <Text style={styles.heading}>Copiar y cortar entre tutoriales</Text>
            <Text style={styles.help}>Selecciona elementos y pulsa Copiar o Cortar. Después, Pegar aquí en la otra lista. Cortar los quita del origen solo al completar el pegado.</Text>
          </View>
          <Action icon="close" label="Cerrar" onPress={close} disabled={busy} />
        </View>
        {clipboard ? <View style={styles.clipboardRow}>
          <Text style={styles.clipboard}>{clipboard.mode === "cut" ? "Cortar" : "Copiar"} · {clipboard.itemKeys.length} elementos · {clipboard.sourceTitle}</Text>
          {clipboard.mode === "cut" ? <Action icon="close-circle-outline" label="Cancelar corte" onPress={cancelCut} disabled={busy} /> : null}
        </View> : null}
        {status ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.status, failed && styles.error]}>{status}</Text> : null}
        {tutorials === undefined ? <ActivityIndicator style={styles.loading} color="#2563eb" /> : lists.length < 2 ? (
          <View style={styles.loading}><Text style={styles.empty}>Necesitas al menos dos listas de tutoriales. Cierra esta pantalla y crea otra con «Nuevo tutorial».</Text></View>
        ) : (
          <View style={[styles.panels, width >= 700 ? styles.panelsRow : styles.panelsColumn]}>
            <TutorialPane label={width >= 700 ? "Lista izquierda" : "Lista superior"} tutorials={lists} selectedId={leftId} otherId={rightId} onChoose={setLeftId}
              clipboard={clipboard} onCopy={copy} onCut={cut} onPaste={paste} busy={busy} />
            <TutorialPane label={width >= 700 ? "Lista derecha" : "Lista inferior"} tutorials={lists} selectedId={rightId} otherId={leftId} onChoose={setRightId}
              clipboard={clipboard} onCopy={copy} onCut={cut} onPaste={paste} busy={busy} />
          </View>
        )}
        {busy ? <View style={styles.busyOverlay}><View style={styles.busyCard}><ActivityIndicator color="#2563eb" /><Text style={styles.itemTitle}>Guardando elementos…</Text></View></View> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  headingBody: { flex: 1, minWidth: 0 },
  heading: { fontSize: 20, fontWeight: "900", color: "#111827" },
  help: { fontSize: 12, lineHeight: 17, color: "#475569", marginTop: 5 },
  panels: { flex: 1, minHeight: 0, padding: 12, gap: 12 },
  panelsRow: { flexDirection: "row" }, panelsColumn: { flexDirection: "column" },
  pane: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", padding: 10, gap: 7 },
  paneLabel: { fontSize: 11, fontWeight: "800", color: "#64748b" },
  selector: { flexDirection: "row", gap: 8, alignItems: "center", borderWidth: 1, borderColor: "#cbd5e1", padding: 10, minHeight: 44 },
  selectorText: { flex: 1, fontWeight: "800", color: "#1e293b", fontSize: 14 },
  picker: { maxHeight: 160, flexGrow: 0, borderWidth: 1, borderColor: "#bfdbfe" },
  pickerItem: { padding: 10, borderBottomWidth: 1, borderColor: "#e2e8f0" },
  search: { minHeight: 38, borderWidth: 1, borderColor: "#cbd5e1", paddingHorizontal: 10, color: "#111827", fontSize: 13 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  action: { flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", minHeight: 38, paddingHorizontal: 9, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },
  actionText: { fontSize: 12, fontWeight: "700", color: "#2563eb" },
  primary: { backgroundColor: "#2563eb", borderColor: "#2563eb" }, primaryText: { color: "#fff" }, disabled: { opacity: 0.4 },
  items: { flex: 1, minHeight: 0 }, itemsContent: { gap: 6, paddingBottom: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 72, padding: 7, borderWidth: 1, borderColor: "#e2e8f0" },
  itemCut: { borderColor: "#d97706", borderStyle: "dashed", backgroundColor: "#fffbeb" },
  itemSelected: { backgroundColor: "#eff6ff", borderColor: "#60a5fa" },
  itemBody: { flex: 1, minWidth: 0 }, itemTitle: { color: "#1e293b", fontWeight: "700", fontSize: 13 },
  meta: { color: "#64748b", fontSize: 11 }, thumbnail: { width: 144, height: 81, flexShrink: 0, backgroundColor: "#f1f5f9" }, fallback: { alignItems: "center", justifyContent: "center" },
  thumbnailSmall: { width: 112, height: 63 },
  clipboardRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  empty: { fontSize: 13, lineHeight: 20, color: "#64748b", padding: 12 },
  clipboard: { fontSize: 12, color: "#475569", flex: 1, minWidth: 150 },
  status: { color: "#166534", backgroundColor: "#f0fdf4", fontSize: 12, padding: 10, marginHorizontal: 12, marginTop: 8 },
  error: { color: "#b91c1c", backgroundColor: "#fef2f2" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  busyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.2)", alignItems: "center", justifyContent: "center" },
  busyCard: { padding: 24, backgroundColor: "#fff", flexDirection: "row", gap: 12, alignItems: "center" },
});
