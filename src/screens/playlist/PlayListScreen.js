import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import CustomYouTubePlaylistPlayer from "@/src/components/chat/CustomYouTubePlaylistPlayer";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { safeAlert, safeConfirm } from "@/src/components/ui/alert/safeAlert";
import { parseYouTubeUrl } from "@/src/services/urlSafety";

const CLIENT_ID_KEY = "shopp-playlist-client-id";
const initialTracks = () => [
  { kind: "single", title: "I. Allegro", url: "", lyrics: null },
  { kind: "single", title: "II. Andante", url: "", lyrics: null },
];

function createClientId() {
  if (typeof globalThis?.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getWebClientId() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const saved = window.localStorage?.getItem(CLIENT_ID_KEY);
    if (saved) return saved;
    const next = createClientId();
    window.localStorage?.setItem(CLIENT_ID_KEY, next);
    return next;
  } catch { return createClientId(); }
}

function formatDate(value) {
  try { return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ""; }
}

function safeFileName(value) {
  return String(value || "playlist")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "playlist";
}

function toExportedPlaylist(playlist) {
  return {
    version: 1,
    type: "shopp-youtube-playlist",
    title: playlist.title,
    exportedAt: new Date().toISOString(),
    tracks: playlist.tracks.map((track) => ({
      kind: track.kind === "album" ? "album" : "single",
      title: track.title,
      url: track.url || (track.playlistId
        ? `https://www.youtube.com/playlist?list=${track.playlistId}`
        : `https://www.youtube.com/watch?v=${track.videoId}`),
      ...(track.lyricsFileName ? { lyricsFileName: track.lyricsFileName } : {}),
    })),
  };
}

async function saveJsonFile(fileName, data) {
  const json = JSON.stringify(data, null, 2);
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const FileSystem = await import("expo-file-system/legacy");
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  await Share.share({ title: fileName, url: uri, message: Platform.OS === "android" ? json : undefined });
}

function parseImportedPayload(value) {
  const candidates = value?.type === "shopp-youtube-playlists" && Array.isArray(value.playlists)
    ? value.playlists
    : [value];
  return candidates.map((playlist, playlistIndex) => {
    if (playlist?.type !== "shopp-youtube-playlist" || !String(playlist.title || "").trim()) {
      throw new Error(`La playlist ${playlistIndex + 1} no tiene un formato compatible.`);
    }
    if (!Array.isArray(playlist.tracks) || playlist.tracks.length < 2 || playlist.tracks.length > 20) {
      throw new Error(`«${playlist.title}» debe contener entre 2 y 20 elementos.`);
    }
    const tracks = playlist.tracks.map((track, index) => {
      const kind = track.kind === "album" ? "album" : "single";
      const parsed = parseYouTubeUrl(String(track.url || ""));
      if (!parsed.isValid || (kind === "album" ? !parsed.playlistId : !parsed.videoId)) {
        throw new Error(`El elemento ${index + 1} de «${playlist.title}» no es válido.`);
      }
      return { kind, videoId: parsed.videoId || undefined, playlistId: parsed.playlistId || undefined, title: String(track.title || "").trim() || `Elemento ${index + 1}` };
    });
    return { title: String(playlist.title).trim(), tracks };
  });
}

export default function PlayListScreen() {
  const [clientId, setClientId] = useState(getWebClientId);
  const playlists = useQuery(api.playlists.listMine, clientId ? { clientId } : "skip");
  const createPlaylist = useMutation(api.playlists.create);
  const updatePlaylist = useMutation(api.playlists.update);
  const removePlaylist = useMutation(api.playlists.remove);
  const generateUploadUrl = useMutation(api.playlists.generateUploadUrl);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [tracks, setTracks] = useState(initialTracks);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web" || clientId) return;
    let active = true;
    AsyncStorage.getItem(CLIENT_ID_KEY).then(async (saved) => {
      const next = saved || createClientId();
      if (!saved) await AsyncStorage.setItem(CLIENT_ID_KEY, next);
      if (active) setClientId(next);
    }).catch(() => { if (active) setClientId(createClientId()); });
    return () => { active = false; };
  }, [clientId]);

  const canSave = useMemo(() => Boolean(title.trim()) && tracks.length >= 2 && tracks.every((track) => {
    const parsed = parseYouTubeUrl(track.url.trim());
    return parsed.isValid && (track.kind === "album" ? Boolean(parsed.playlistId) : Boolean(parsed.videoId));
  }) && !saving, [saving, title, tracks]);

  const openNew = useCallback(() => {
    setEditingId(null); setTitle(""); setTracks(initialTracks()); setEditorVisible(true);
  }, []);

  const openEdit = useCallback((item) => {
    setEditingId(item._id); setTitle(item.title || "");
    setTracks(item.tracks.map((track, index) => ({
      kind: track.kind === "album" ? "album" : "single",
      title: track.title || `Elemento ${index + 1}`,
      url: track.url || (track.playlistId ? `https://www.youtube.com/playlist?list=${track.playlistId}` : `https://www.youtube.com/watch?v=${track.videoId || ""}`),
      lyrics: track.lyricsStorageId ? { existing: true, storageId: track.lyricsStorageId, fileName: track.lyricsFileName || "lyrics.lrc", mimeType: track.lyricsMimeType || "text/plain", size: track.lyricsSize || 0 } : null,
    })));
    setEditorVisible(true);
  }, []);

  const updateTrack = useCallback((index, field, value) => {
    setTracks((current) => current.map((track, currentIndex) => currentIndex === index ? { ...track, [field]: value } : track));
  }, []);

  const pickLyrics = useCallback(async (index) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/plain", "application/octet-stream"], copyToCacheDirectory: true, multiple: false });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      const fileName = asset.name || "lyrics.lrc";
      if (!fileName.toLowerCase().endsWith(".lrc")) return safeAlert("Formato no válido", "Selecciona un fichero con extensión .lrc.");
      if ((asset.size || 0) > 512 * 1024) return safeAlert("Fichero demasiado grande", "El fichero LRC no puede superar 512 KB.");
      updateTrack(index, "lyrics", { uri: asset.uri, fileName, mimeType: asset.mimeType || "text/plain", size: asset.size || 0 });
    } catch (error) {
      safeAlert("No se pudieron añadir las letras", error?.message || "Inténtalo de nuevo.");
    }
  }, [updateTrack]);

  const addTrack = useCallback(() => setTracks((current) => current.length >= 20 ? current : [...current, { kind: "single", title: `Single ${current.length + 1}`, url: "", lyrics: null }]), []);
  const removeTrack = useCallback((index) => setTracks((current) => current.length <= 2 ? current : current.filter((_, i) => i !== index)), []);

  const uploadLyrics = useCallback(async (lyrics, index) => {
    if (!lyrics) return {};
    if (lyrics.existing) return { lyricsStorageId: lyrics.storageId, lyricsFileName: lyrics.fileName, lyricsMimeType: lyrics.mimeType, lyricsSize: lyrics.size };
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(lyrics.uri);
    const blob = await response.blob();
    const uploadResponse = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": lyrics.mimeType || "text/plain" }, body: blob });
    if (!uploadResponse.ok) throw new Error(`No se pudieron subir las letras del elemento ${index + 1}.`);
    const { storageId } = await uploadResponse.json();
    return { lyricsStorageId: storageId, lyricsFileName: lyrics.fileName, lyricsMimeType: lyrics.mimeType || "text/plain", lyricsSize: lyrics.size || blob.size || 0 };
  }, [generateUploadUrl]);

  const save = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const normalizedTracks = [];
      for (let index = 0; index < tracks.length; index += 1) {
        const track = tracks[index];
        const parsed = parseYouTubeUrl(track.url.trim());
        const lyrics = await uploadLyrics(track.lyrics, index);
        normalizedTracks.push({
          kind: track.kind === "album" ? "album" : "single",
          videoId: parsed.videoId || undefined,
          playlistId: parsed.playlistId || undefined,
          title: track.title.trim() || `${track.kind === "album" ? "Álbum" : "Single"} ${index + 1}`,
          ...lyrics,
        });
      }
      const args = { clientId, title: title.trim(), tracks: normalizedTracks };
      if (editingId) await updatePlaylist({ playlistId: editingId, ...args });
      else await createPlaylist(args);
      setEditorVisible(false);
    } catch (error) {
      safeAlert("No se pudo guardar la playlist", error?.message || "Revisa los enlaces de YouTube.");
    } finally { setSaving(false); }
  }, [canSave, clientId, createPlaylist, editingId, title, tracks, updatePlaylist, uploadLyrics]);

  const confirmRemove = useCallback((item) => safeConfirm("Borrar playlist", `¿Quieres borrar «${item.title}»?`, async () => {
    setDeletingId(item._id);
    try { await removePlaylist({ playlistId: item._id, clientId }); }
    catch (error) { safeAlert("No se pudo borrar", error?.message || "Inténtalo de nuevo."); }
    finally { setDeletingId(null); }
  }, { confirmText: "Borrar", destructive: true }), [clientId, removePlaylist]);

  const exportPlaylist = useCallback(async (item) => {
    try { await saveJsonFile(`${safeFileName(item.title)}.json`, toExportedPlaylist(item)); }
    catch (error) { safeAlert("No se pudo exportar", error?.message || "Inténtalo de nuevo."); }
  }, []);

  const exportAll = useCallback(async () => {
    try {
      await saveJsonFile("shopp-playlists.json", {
        version: 1, type: "shopp-youtube-playlists", exportedAt: new Date().toISOString(),
        playlists: (playlists || []).map(toExportedPlaylist),
      });
    } catch (error) { safeAlert("No se pudo exportar", error?.message || "Inténtalo de nuevo."); }
  }, [playlists]);

  const importJson = useCallback(async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/json", "text/plain"], copyToCacheDirectory: true, multiple: false });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      const response = await fetch(asset.uri);
      const imported = parseImportedPayload(JSON.parse(await response.text()));
      const existingSignatures = new Set((playlists || []).map((item) => `${item.title.toLowerCase()}|${item.tracks.map((track) => track.videoId || track.playlistId).join(",")}`));
      let added = 0; let skipped = 0;
      for (const playlist of imported) {
        const signature = `${playlist.title.toLowerCase()}|${playlist.tracks.map((track) => track.videoId || track.playlistId).join(",")}`;
        if (existingSignatures.has(signature)) { skipped += 1; continue; }
        await createPlaylist({ clientId, ...playlist });
        existingSignatures.add(signature); added += 1;
      }
      safeAlert("Importación terminada", `${added} playlist${added === 1 ? "" : "s"} importada${added === 1 ? "" : "s"}.${skipped ? ` ${skipped} duplicada${skipped === 1 ? "" : "s"} omitida${skipped === 1 ? "" : "s"}.` : ""}`);
    } catch (error) {
      safeAlert("No se pudo importar", error instanceof SyntaxError ? "El fichero no contiene un JSON válido." : (error?.message || "Revisa el fichero seleccionado."));
    } finally { setImporting(false); }
  }, [clientId, createPlaylist, playlists]);

  const importIntoEditor = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/json", "text/plain"], copyToCacheDirectory: true, multiple: false });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      const response = await fetch(asset.uri);
      const imported = parseImportedPayload(JSON.parse(await response.text()))[0];
      setEditingId(null);
      setTitle(imported.title);
      setTracks(imported.tracks.map((track, index) => ({
        kind: track.kind,
        title: track.title || `Elemento ${index + 1}`,
        url: track.playlistId
          ? `https://www.youtube.com/playlist?list=${track.playlistId}`
          : `https://www.youtube.com/watch?v=${track.videoId}`,
        lyrics: null,
      })));
    } catch (error) {
      safeAlert("No se pudo importar", error instanceof SyntaxError ? "El fichero no contiene un JSON válido." : (error?.message || "Revisa el fichero seleccionado."));
    }
  }, []);

  const exportEditor = useCallback(async () => {
    if (!canSave) return;
    try {
      await saveJsonFile(`${safeFileName(title)}.json`, {
        version: 1, type: "shopp-youtube-playlist", title: title.trim(), exportedAt: new Date().toISOString(),
        tracks: tracks.map((track, index) => ({
          kind: track.kind === "album" ? "album" : "single",
          title: track.title.trim() || `Elemento ${index + 1}`,
          url: parseYouTubeUrl(track.url).playableUrl,
          ...(track.lyrics?.fileName ? { lyricsFileName: track.lyrics.fileName } : {}),
        })),
      });
    } catch (error) { safeAlert("No se pudo exportar", error?.message || "Inténtalo de nuevo."); }
  }, [canSave, title, tracks]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}><Text style={styles.heading}>Mis playlists</Text><Text style={styles.subtitle}>Combina canciones individuales y álbumes de YouTube.</Text></View>
        <View style={styles.headerActions}>
          <Pressable onPress={importJson} disabled={importing} style={styles.secondaryButton}><Ionicons name="download-outline" size={18} color="#475569" /><Text style={styles.secondaryButtonText}>{importing ? "Importando…" : "Importar"}</Text></Pressable>
          {playlists?.length ? <Pressable onPress={exportAll} style={styles.secondaryButton}><Ionicons name="archive-outline" size={18} color="#475569" /><Text style={styles.secondaryButtonText}>Exportar todo</Text></Pressable> : null}
          <Pressable onPress={openNew} style={styles.newButton}><Ionicons name="add-circle-outline" size={20} color="#fff" /><Text style={styles.newButtonText}>Nueva playlist</Text></Pressable>
        </View>
      </View>
      {playlists === undefined ? <View style={styles.center}><ActivityIndicator color="#dc2626" /></View> : (
        <FlatList data={playlists} keyExtractor={(item) => item._id} contentContainerStyle={[styles.list, !playlists.length && styles.emptyList]} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => <View style={styles.playerCard}><CustomYouTubePlaylistPlayer playlist={item} userName="Mi playlist" dateLabel={formatDate(item.updatedAt)} canEdit canDelete deleting={deletingId === item._id} onEdit={() => openEdit(item)} onDelete={() => confirmRemove(item)} /><Pressable onPress={() => exportPlaylist(item)} style={styles.exportButton}><Ionicons name="share-outline" size={17} color="#2563eb" /><Text style={styles.exportButtonText}>Exportar JSON</Text></Pressable></View>}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="logo-youtube" size={46} color="#dc2626" /><Text style={styles.emptyTitle}>Todavía no hay playlists</Text><Text style={styles.emptyText}>Crea una combinando singles o álbumes mediante sus enlaces de YouTube.</Text><Pressable onPress={openNew} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Nueva playlist</Text></Pressable></View>} />
      )}
      <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={() => !saving && setEditorVisible(false)}>
        <View style={styles.backdrop}><View style={styles.editorCard}>
          <View style={styles.editorHeader}><View style={{ flex: 1 }}><Text style={styles.editorTitle}>{editingId ? "Editar playlist de Shopp" : "Nueva playlist de Shopp"}</Text><Text style={styles.editorSubtitle}>Añade singles o álbumes mediante sus enlaces de YouTube.</Text></View><Pressable onPress={() => !saving && setEditorVisible(false)} style={styles.closeButton}><Ionicons name="close" size={24} color="#475569" /></Pressable></View>
          <Text style={styles.label}>Nombre del concierto o playlist</Text>
          <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Mozart · Concierto para piano · Daniel Barenboim" style={styles.titleInput} />
          <View style={styles.editorTransferRow}>
            <Pressable onPress={importIntoEditor} style={styles.editorTransferButton}><Ionicons name="download-outline" size={17} color="#2563eb" /><Text style={styles.editorTransferText}>Importar JSON</Text></Pressable>
            <Pressable onPress={exportEditor} disabled={!canSave} style={[styles.editorTransferButton, !canSave && styles.disabled]}><Ionicons name="share-outline" size={17} color="#2563eb" /><Text style={styles.editorTransferText}>Exportar JSON</Text></Pressable>
          </View>
          <ScrollView style={styles.tracksScroll} keyboardShouldPersistTaps="handled">
            {tracks.map((track, index) => <View key={`track-${index}`} style={styles.trackEditor}>
              <View style={styles.trackHeader}><Text style={styles.trackNumber}>ELEMENTO {index + 1}</Text>{tracks.length > 2 ? <Pressable onPress={() => removeTrack(index)} style={styles.removeButton}><Ionicons name="trash-outline" size={18} color="#dc2626" /></Pressable> : null}</View>
              <View style={styles.kindRow}>
                <Pressable onPress={() => updateTrack(index, "kind", "single")} style={[styles.kindButton, track.kind !== "album" && styles.kindActive]}><Ionicons name="musical-note-outline" size={16} color={track.kind !== "album" ? "#fff" : "#475569"} /><Text style={[styles.kindText, track.kind !== "album" && styles.kindTextActive]}>Single</Text></Pressable>
                <Pressable onPress={() => updateTrack(index, "kind", "album")} style={[styles.kindButton, track.kind === "album" && styles.kindActive]}><Ionicons name="albums-outline" size={16} color={track.kind === "album" ? "#fff" : "#475569"} /><Text style={[styles.kindText, track.kind === "album" && styles.kindTextActive]}>Álbum</Text></Pressable>
              </View>
              <TextInput value={track.title} onChangeText={(value) => updateTrack(index, "title", value)} maxLength={120} placeholder={track.kind === "album" ? "Título del álbum" : "I. Allegro"} style={styles.trackInput} />
              <TextInput value={track.url} onChangeText={(value) => updateTrack(index, "url", value)} autoCapitalize="none" autoCorrect={false} placeholder={track.kind === "album" ? "https://youtube.com/playlist?list=..." : "https://youtu.be/..."} style={styles.trackInput} />
              <View style={styles.lyricsRow}><Pressable onPress={() => pickLyrics(index)} style={styles.lyricsButton}><Ionicons name="document-text-outline" size={20} color="#2563eb" /><View style={{ flex: 1 }}><Text style={styles.lyricsTitle} numberOfLines={1}>{track.lyrics?.fileName || "Añadir letras .lrc"}</Text><Text style={styles.lyricsHint}>Opcional · máximo 512 KB</Text></View></Pressable>{track.lyrics ? <Pressable onPress={() => updateTrack(index, "lyrics", null)} style={styles.removeLyrics}><Ionicons name="close-circle" size={21} color="#dc2626" /></Pressable> : null}</View>
            </View>)}
            {tracks.length < 20 ? <Pressable onPress={addTrack} style={styles.addButton}><Ionicons name="add-circle-outline" size={20} color="#dc2626" /><Text style={styles.addText}>Añadir elemento</Text></Pressable> : null}
          </ScrollView>
          <View style={styles.actions}><Pressable onPress={() => setEditorVisible(false)} disabled={saving} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable onPress={save} disabled={!canSave} style={[styles.saveButton, !canSave && styles.disabled]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editingId ? "Guardar cambios" : "Crear playlist"}</Text>}</Pressable></View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7fb" }, header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", backgroundColor: "#fff", flexWrap: "wrap" }, headerText: { flex: 1, minWidth: 220 }, heading: { fontSize: 22, fontWeight: "900", color: "#111827" }, subtitle: { marginTop: 3, fontSize: 12, color: "#64748b" }, headerActions: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }, secondaryButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff" }, secondaryButtonText: { fontSize: 12, fontWeight: "800", color: "#475569" }, newButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, backgroundColor: "#dc2626" }, newButtonText: { fontWeight: "800", color: "#fff" }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, list: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 14 }, playerCard: { alignItems: "center" }, exportButton: { width: 440, maxWidth: "100%", minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderTopWidth: 0, borderColor: "#d1d5db", backgroundColor: "#fff" }, exportButtonText: { fontSize: 12, fontWeight: "800", color: "#2563eb" }, emptyList: { flexGrow: 1, justifyContent: "center" }, empty: { alignItems: "center", padding: 24 }, emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "900", color: "#111827" }, emptyText: { maxWidth: 410, marginTop: 7, textAlign: "center", color: "#64748b" }, emptyButton: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: "#dc2626" }, emptyButtonText: { fontWeight: "800", color: "#fff" },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(15,23,42,0.55)" }, editorCard: { width: "100%", maxWidth: 750, maxHeight: "92%", padding: 18, backgroundColor: "#fff" }, editorHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 }, editorTitle: { fontSize: 20, fontWeight: "900", color: "#111827" }, editorSubtitle: { marginTop: 3, fontSize: 12, color: "#64748b" }, closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#cbd5e1" }, label: { marginBottom: 7, fontSize: 12, fontWeight: "900", color: "#334155" }, titleInput: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: "#cbd5e1", color: "#111827" }, editorTransferRow: { flexDirection: "row", gap: 8, marginTop: 9 }, editorTransferButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff" }, editorTransferText: { fontSize: 11, fontWeight: "800", color: "#2563eb" }, tracksScroll: { marginTop: 12 }, trackEditor: { marginBottom: 10, padding: 12, borderWidth: 1, borderColor: "#dbe2ea", backgroundColor: "#f8fafc" }, trackHeader: { flexDirection: "row", alignItems: "center" }, trackNumber: { flex: 1, fontSize: 11, fontWeight: "900", color: "#dc2626" }, removeButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center" }, kindRow: { flexDirection: "row", marginTop: 6 }, kindButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff" }, kindActive: { borderColor: "#dc2626", backgroundColor: "#dc2626" }, kindText: { fontSize: 12, fontWeight: "800", color: "#475569" }, kindTextActive: { color: "#fff" }, trackInput: { minHeight: 44, marginTop: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", color: "#111827" }, lyricsRow: { flexDirection: "row", alignItems: "center", marginTop: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "#93c5fd", backgroundColor: "#eff6ff" }, lyricsButton: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12 }, lyricsTitle: { fontSize: 12, fontWeight: "800", color: "#2563eb" }, lyricsHint: { marginTop: 2, fontSize: 10, color: "#64748b" }, removeLyrics: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, addButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderStyle: "dashed", borderColor: "#f87171" }, addText: { fontWeight: "800", color: "#b91c1c" }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 }, cancelButton: { minWidth: 115, minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#cbd5e1" }, cancelText: { fontWeight: "800", color: "#475569" }, saveButton: { minWidth: 155, minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: "#dc2626" }, disabled: { opacity: 0.4 }, saveText: { fontWeight: "900", color: "#fff" },
});
