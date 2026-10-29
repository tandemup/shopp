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
const permanentCardUrl = (id) => `${ORIGIN}/music-card.html?card=${encodeURIComponent(id)}`;

export default function MusicCardsManager({ visible, onClose, playlists = [], isClassical, onPrepare }) {
  const [results, setResults] = useState({});
  const publishSingle = useMutation(api.publicMusicCards.publishSingle);
  const publishedCards = useQuery(api.publicMusicCards.listMine);
  const publish = async (card) => {
    const key = String(card.playlist._id || card.id);
    if (busyId) return;
    setBusyId(key);
    try {
      const tracks = card.playlist.tracks || [];
      if (tracks.length !== 1) throw new Error("Fase 1: publicación disponible solo para playlists de una canción.");
      const track = tracks[0];
      const videoId = videoIdFromTrack(track);
      if (!videoId) throw new Error("Esta canción no tiene un vídeo YouTube válido.");
      const localLyrics = await getLocalLyrics(track);
      const lyrics = localLyrics?.text?.trim() || undefined;
      // Publicación inmutable: una nueva edición requiere una tarjeta nueva explícita.
      const uuid = typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      const id = `card-${uuid}`;
      await publishSingle({
        id, title: track.title || card.playlist.title || "Canción",
        author: track.author || track.artist || card.playlist.author || card.playlist.artist || "",
        videoId, ...(lyrics ? { lyrics } : {}),
      });
      setResults(old => ({ ...old, [key]: { kind: "published", message: `Guardada en Convex: ${id}. Publica la fase 2 en Netlify antes de imprimir.` } }));
    } catch (error) {
      setResults(old => ({ ...old, [key]: { kind: "error", message: error?.message || "No se pudo publicar" } }));
    } finally { setBusyId(null); }
  };
  const [busyId, setBusyId] = useState(null);
  const cards = useMemo(() => (Array.isArray(playlists) ? playlists : []).map((playlist) => ({
    playlist,
    id: publicIdForPlaylist(playlist),
  })), [playlists]);

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
            <Text style={styles.heading}>Gestionar Music Cards</Text>
            <Text style={styles.hint}>{cards.length} colecciones · estado público en Netlify</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar gestor" onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={23} color="#334155" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.hint}>Pulsa «Verificar» para comprobar una ficha. No se modifica la playlist, el QR ni la publicación.</Text>
          {cards.map((card, index) => {
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
                <Pressable accessibilityRole="button" disabled={!!busyId} style={styles.button} onPress={() => verify(card)}>
                  {checking ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Ionicons name="checkmark-circle-outline" color="#1d4ed8" size={17} />}
                  <Text style={styles.buttonText}>Verificar</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.button} onPress={() => onPrepare(card.playlist)}>
                  <Ionicons name="print-outline" color="#1d4ed8" size={17} />
                  <Text style={styles.buttonText}>Preparar</Text>
                </Pressable>
                {(card.playlist.tracks || []).length === 1 ? (
                  <Pressable accessibilityRole="button" disabled={!!busyId} style={styles.button} onPress={() => publish(card)}>
                    <Ionicons name="cloud-upload-outline" color="#1d4ed8" size={17} />
                    <Text style={styles.buttonText}>Guardar en Convex (fase 1)</Text>
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
          <Text style={styles.title}>Tarjetas guardadas en Convex</Text>
          <Text style={styles.hint}>Comprueba primero el enlace en Netlify. El QR solo será definitivo cuando Netlify y Shopp consulten el mismo despliegue de Convex.</Text>
          {(publishedCards || []).map(item => (
            <View key={item.id} style={styles.item}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.hint}>{item.id}</Text>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => Linking.openURL(permanentCardUrl(item.id))}>
                <Ionicons name="open-outline" color="#1d4ed8" size={17} />
                <Text style={styles.buttonText}>Probar enlace público</Text>
              </Pressable>
            </View>
          ))}
          {cards.length === 0 ? <Text style={styles.hint}>No hay playlists para gestionar.</Text> : null}
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
