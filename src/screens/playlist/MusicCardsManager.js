import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getLocalLyrics } from "@/src/storage/lyricsStorage";
import { videoIdFromTrack } from "@/src/services/musicCardLinks";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import { buildPlaylistCardUrl, buildPublicManifest, comparePublicPlaylist, getPublicManifestUrl, publicIdForPlaylist } from "@/src/services/musicCardLinks";

const ORIGIN = "https://ramworks.netlify.app";

export default function MusicCardsManager({ visible, onClose, playlists = [], selectedPlaylist = null, isClassical, onPrepare }) {
  const [results, setResults] = useState({});
  const publishSingle = useMutation(api.publicMusicCards.publishSingle);
  const linkExisting = useMutation(api.publicMusicCards.linkExisting);
  const publishedCards = useQuery(api.publicMusicCards.listMine);
  const selectedKey = selectedPlaylist == null ? null : String(selectedPlaylist._id || publicIdForPlaylist(selectedPlaylist));
  const published = Array.isArray(publishedCards) ? publishedCards : [];
  const hasPublishedCard = (playlist) => (playlist.tracks || []).length === 1 && published.some(item =>
    item.sourcePlaylistId
      ? item.sourcePlaylistId === String(playlist._id || playlist.id || publicIdForPlaylist(playlist)) && item.sourceTrackKey === "single"
      : item.videoId === videoIdFromTrack(playlist.tracks[0]));
  const publish = async (card) => {
    const key = String(card.playlist._id || card.id);
    if (busyId) return;
    if (hasPublishedCard(card.playlist)) {
      setResults(old => ({ ...old, [key]: { kind: "published", message: "Ya hay una ficha Convex para este vídeo. Utiliza Preparar QR Convex." } }));
      return;
    }
    setBusyId(key);
    try {
      const tracks = card.playlist.tracks || [];
      if (tracks.length !== 1) throw new Error("Fase 1: publicación disponible solo para playlists de una canción.");
      const track = tracks[0];
      const videoId = videoIdFromTrack(track);
      if (!videoId) throw new Error("Esta canción no tiene un vídeo YouTube válido.");
      const localLyrics = await getLocalLyrics(track);
      const lyrics = localLyrics?.text?.trim() || undefined;
      if ((publishedCards || []).some(c => !c.sourcePlaylistId && c.videoId === videoId)) {
        throw new Error("Ya hay una ficha antigua con este vídeo. Vincúlala primero para evitar duplicados.");
      }
      // Cada publicación recibe un ID nuevo. No se vincula a posteriores cambios de playlist.
      const uuid = typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      const id = `card-${uuid}`;
      const saved = await publishSingle({
        id, sourcePlaylistId: String(card.playlist._id || card.playlist.id || publicIdForPlaylist(card.playlist)), sourceTrackKey: "single", title: track.title || card.playlist.title || "Canción",
        author: track.author || track.artist || card.playlist.author || card.playlist.artist || "",
        videoId, ...(lyrics ? { lyrics } : {}),
      });
      setResults(old => ({ ...old, [key]: { kind: "published", message: saved.reused
        ? `Ficha existente reutilizada: ${saved.id}` : `Guardada en Convex: ${saved.id}` } }));
    } catch (error) {
      setResults(old => ({ ...old, [key]: { kind: "error", message: error?.message || "No se pudo publicar" } }));
    } finally { setBusyId(null); }
  };
  const [busyId, setBusyId] = useState(null);
  const cards = useMemo(() => (Array.isArray(playlists) ? playlists : []).map((playlist) => ({
    playlist,
    id: publicIdForPlaylist(playlist),
  })), [playlists]);

  const visibleCards = selectedKey == null ? cards : cards.filter(card => String(card.playlist._id || card.id) === selectedKey);
  const visiblePublished = selectedKey == null ? published : published.filter(item => visibleCards.some(card =>
    (card.playlist.tracks || []).length === 1 && (item.sourcePlaylistId
      ? (String(card.playlist._id || card.playlist.id || card.id) === item.sourcePlaylistId && item.sourceTrackKey === "single")
      : videoIdFromTrack(card.playlist.tracks[0]) === item.videoId)));

  const verify = async (card) => {
    if (busyId) return;
    const key = String(card.playlist._id || card.id);
    setBusyId(key);
    try {
      const url = getPublicManifestUrl(ORIGIN, card.id);
      if (!url) throw new Error("Identificador público no válido");
      const response = await fetch(`${url}?verify=${Date.now()}`, { cache: "no-store" });
      if (response.status === 404) {
        setResults((old) => ({ ...old, [key]: { kind: "local", message: "Ficha no publicada (HTTP 404)" } }));
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = (response.headers.get("content-type") || "").toLowerCase();
      if (!type.includes("json")) throw new Error("Netlify no devuelve JSON");
      const published = await response.json();
      if (published?.schema !== "shopp-public-music-card" || published?.id !== card.id || !Array.isArray(published?.tracks)) {
        throw new Error("Ficha pública inválida o identificador diferente");
      }
      const expected = buildPublicManifest(card.playlist, card.id, isClassical);
      const comparison = comparePublicPlaylist(expected, published);
      setResults((old) => ({ ...old, [key]: comparison.ok
        ? { kind: "published", message: `Publicada · ${published.tracks.length} pistas` }
        : { kind: "outdated", message: comparison.reason || "Publicación diferente de la versión local" } }));
    } catch (error) {
      setResults((old) => ({ ...old, [key]: { kind: "error", message: error?.message || "No se pudo comprobar" } }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>{selectedKey == null ? "Gestionar Music Cards" : "Preparar tarjeta musical"}</Text>
            <Text style={styles.hint}>{selectedKey == null ? `${cards.length} colecciones · fichas Convex y compatibilidad` : (selectedPlaylist?.title || "Playlist seleccionada")}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar gestor" onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={23} color="#334155" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.hint}>{selectedKey == null ? "Las fichas Convex se pueden imprimir sin ZIP. La verificación JSON se conserva solo para publicaciones antiguas." : "Publica la canción una sola vez; después reutiliza su QR permanente. Las playlists de varias pistas mantienen temporalmente su impresión heredada."}</Text>
          {visibleCards.map((card, index) => {
            const key = String(card.playlist._id || card.id);
            const result = results[key];
            const checking = busyId === key;
            return <View style={styles.item} key={`${key}-${index}`}>
              <Text style={styles.title}>{card.playlist.title || `Colección ${index + 1}`}</Text>
              <Text style={styles.hint}>{card.playlist.tracks?.length || 0} pistas · {card.id}</Text>
              <Text style={[styles.status, result?.kind === "published" && styles.good, result?.kind === "outdated" && styles.warning]}>
                {result?.message || "Sin comprobar"}
              </Text>
              <View style={styles.actions}>
                {(card.playlist.tracks || []).length !== 1 ? (
                  <>
                    <Text style={styles.hint}>La publicación Convex de varias pistas se incorporará en una entrega posterior.</Text>
                    <Pressable accessibilityRole="button" style={styles.button} onPress={() => onPrepare(card.playlist)}>
                      <Ionicons name="print-outline" color="#1d4ed8" size={17} />
                      <Text style={styles.buttonText}>Impresión heredada</Text>
                    </Pressable>
                  </>
                ) : hasPublishedCard(card.playlist) ? (
                  <Text style={styles.good}>Ficha ya publicada. Selecciona «Preparar QR Convex» más abajo.</Text>
                ) : (
                  <Pressable accessibilityRole="button" disabled={!!busyId || publishedCards === undefined} style={styles.button} onPress={() => publish(card)}>
                    {checking ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Ionicons name="cloud-upload-outline" color="#1d4ed8" size={17} />}
                    <Text style={styles.buttonText}>Publicar en Convex</Text>
                  </Pressable>
                )}
                {selectedKey == null ? (
                  <Pressable accessibilityRole="button" disabled={!!busyId} style={styles.button} onPress={() => verify(card)}>
                    <Ionicons name="checkmark-circle-outline" color="#1d4ed8" size={17} />
                    <Text style={styles.buttonText}>Verificar JSON antiguo</Text>
                  </Pressable>
                ) : null}
                {result?.kind === "outdated" || (result?.kind === "published" && !result.message?.includes("Convex")) ? (
                  <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
                    const url = buildPlaylistCardUrl(ORIGIN, card.id, "landing");
                    if (url) Linking.openURL(url);
                  }}>
                    <Ionicons name="open-outline" color="#1d4ed8" size={17} />
                    <Text style={styles.buttonText}>Abrir QR</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>;
          })}
          <Text style={styles.title}>Fichas publicadas en Convex</Text>
          <Text style={styles.hint}>Cada ficha conserva su ID aunque cambie la playlist local. Antes de imprimir, comprueba que el reproductor público funciona. No publiques otra copia innecesariamente.</Text>
          {publishedCards === undefined ? <ActivityIndicator size="small" color="#1d4ed8" /> : null}
          {visiblePublished.map(item => {
            const exactMatches = visibleCards.filter(c => (c.playlist.tracks || []).length === 1 &&
              String(c.playlist._id || c.playlist.id || c.id) === item.sourcePlaylistId && item.sourceTrackKey === "single");
            const match = exactMatches.length === 1 ? exactMatches[0] : null;
            const legacyCandidates = !item.sourcePlaylistId ? visibleCards.filter(c => (c.playlist.tracks || []).length === 1 &&
              videoIdFromTrack(c.playlist.tracks[0]) === item.videoId) : [];
            const publicUrl = `${ORIGIN}/music-card.html?card=${encodeURIComponent(item.id)}`;
            return <View key={item.id} style={styles.item}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.hint}>{item.id}</Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" style={styles.button} onPress={() => Linking.openURL(publicUrl)}>
                  <Ionicons name="open-outline" color="#1d4ed8" size={17} />
                  <Text style={styles.buttonText}>Probar reproductor</Text>
                </Pressable>
                {!item.sourcePlaylistId && legacyCandidates.length === 1 ? (
                  <Pressable accessibilityRole="button" style={styles.button} onPress={async () => {
                    const candidate = legacyCandidates[0];
                    try {
                      await linkExisting({ id: item.id,
                        sourcePlaylistId: String(candidate.playlist._id || candidate.playlist.id || publicIdForPlaylist(candidate.playlist)),
                        sourceTrackKey: "single", expectedVideoId: item.videoId });
                      setResults(old => ({ ...old, [String(candidate.playlist._id || candidate.id)]: {
                        kind: "published", message: `Ficha ${item.id} vinculada a esta playlist` } }));
                    } catch (err) {
                      setResults(old => ({ ...old, [String(candidate.playlist._id || candidate.id)]: {
                        kind: "error", message: err?.message || "No se pudo vincular" } }));
                    }
                  }}>
                    <Ionicons name="link-outline" color="#1d4ed8" size={17} />
                    <Text style={styles.buttonText}>Vincular ficha antigua</Text>
                  </Pressable>
                ) : null}
                {match ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => onPrepare(match.playlist, { id: item.id, videoId: item.videoId, origin: ORIGIN })}>
                  <Ionicons name="print-outline" color="#1d4ed8" size={17} />
                  <Text style={styles.buttonText}>Preparar QR Convex</Text>
                </Pressable> : <Text style={styles.hint}>{!item.sourcePlaylistId ? "Primero vincula explícitamente la ficha antigua a su playlist." : "La playlist original no está disponible localmente."}</Text>}
              </View>
            </View>;
          })}
          {visibleCards.length === 0 ? <Text style={styles.hint}>No se ha encontrado la playlist seleccionada. Cierra y vuelve a abrir Music Cards.</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  header: { paddingHorizontal: 18, paddingVertical: 17, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#e2e8f0" },
  heading: { fontSize: 21, fontWeight: "700", color: "#0f172a" },
  hint: { color: "#64748b", fontSize: 12, marginTop: 3 },
  close: { padding: 7 },
  list: { padding: 16, paddingBottom: 42, gap: 12 },
  item: { padding: 14, backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 12, gap: 6 },
  title: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  status: { fontSize: 13, color: "#64748b", marginTop: 3 },
  good: { color: "#15803d" },
  warning: { color: "#a16207" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  button: { borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", paddingVertical: 8, paddingHorizontal: 11, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  buttonText: { fontSize: 13, color: "#1d4ed8", fontWeight: "600" },
});
