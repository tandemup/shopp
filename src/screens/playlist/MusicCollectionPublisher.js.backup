import React, { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I18nText as Text } from "@/src/i18n";
import { getLocalLyrics } from "@/src/storage/lyricsStorage";
import { publicIdForPlaylist, videoIdFromTrack } from "@/src/services/musicCardLinks";

const ORIGIN = "https://ramworks.netlify.app";
const sourceId = p => String(p?._id || p?.id || publicIdForPlaylist(p));
const makeId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") return `card-${globalThis.crypto.randomUUID()}`;
  return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

function PlaylistSelection({ playlist, published, publishCollection }) {
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const [order, setOrder] = useState(() => tracks.map((_, i) => i));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [lastId, setLastId] = useState(null);
  const sourcePlaylistId = sourceId(playlist);
  const existing = published.find(c => c.sourcePlaylistId === sourcePlaylistId && c.sourceTrackKey === "collection");
  const selected = order.filter(i => Number.isInteger(i) && i >= 0 && i < tracks.length);
  const toggle = i => setOrder(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  const move = (i, delta) => setOrder(prev => {
    const from = prev.indexOf(i), to = from + delta;
    if (from < 0 || to < 0 || to >= prev.length) return prev;
    const next = [...prev]; [next[from], next[to]] = [next[to], next[from]]; return next;
  });

  const submit = async () => {
    if (busy || existing) return;
    if (!selected.length || selected.length > 30) { setFeedback("Selecciona entre 1 y 30 pistas."); return; }
    setBusy(true); setFeedback("");
    try {
      const output = [];
      for (const i of selected) {
        const track = tracks[i];
        const videoId = videoIdFromTrack(track);
        if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error(`Pista ${i + 1}: enlace YouTube no válido.`);
        const localLyrics = await getLocalLyrics(track);
        const lyrics = localLyrics?.text?.trim();
        output.push({
          title: String(track.title || track.name || `Pista ${i + 1}`).trim(),
          author: String(track.author || track.artist || playlist.author || playlist.artist || "").trim(),
          videoId,
          ...(lyrics ? { lyrics } : {}),
        });
      }
      const saved = await publishCollection({
        id: makeId(), title: String(playlist.title || playlist.name || "Colección musical"),
        author: String(playlist.author || playlist.artist || ""), sourcePlaylistId,
        tracks: output,
      });
      setLastId(saved.id);
      setFeedback(saved.reused ? "Se ha reutilizado la colección ya publicada." : "Colección publicada en Convex. El orden queda congelado.");
    } catch (error) {
      setFeedback(error?.message || "No se pudo publicar la colección.");
    } finally { setBusy(false); }
  };

  return <View style={styles.panel}>
    <Text style={styles.heading}>{playlist.title || playlist.name || "Playlist"}</Text>
    {existing ? <>
      <Text style={styles.ok}>Colección ya publicada · {existing.id} · {existing.trackCount || "?"} pistas</Text>
      <Text style={styles.small}>Esta publicación es una instantánea. Editar la playlist no modifica el QR existente.</Text>
    </> : <>
      <Text style={styles.small}>Marca las pistas y cambia el orden con las flechas. La primera publicación fija esta selección para este origen.</Text>
      {tracks.map((track, i) => {
        const position = selected.indexOf(i), active = position >= 0;
        return <View key={`${i}-${String(track?.title || "")}`} style={styles.track}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => toggle(i)} style={styles.trackMain}>
            <Ionicons name={active ? "checkbox" : "square-outline"} size={22} color="#1d4ed8" />
            <Text style={styles.trackText}>{track.title || track.name || `Pista ${i + 1}`}</Text>
          </Pressable>
          {active ? <View style={styles.arrows}>
            <Pressable accessibilityLabel="Subir pista" accessibilityRole="button" disabled={position === 0} onPress={() => move(i, -1)}><Ionicons name="arrow-up-circle-outline" size={23} color={position === 0 ? "#94a3b8" : "#1d4ed8"}/></Pressable>
            <Pressable accessibilityLabel="Bajar pista" accessibilityRole="button" disabled={position === selected.length - 1} onPress={() => move(i, 1)}><Ionicons name="arrow-down-circle-outline" size={23} color={position === selected.length - 1 ? "#94a3b8" : "#1d4ed8"}/></Pressable>
            <Text style={styles.small}>{position + 1}</Text>
          </View> : null}
        </View>;
      })}
      <Pressable accessibilityRole="button" disabled={busy || selected.length === 0 || selected.length > 30} onPress={submit} style={[styles.button, (busy || !selected.length || selected.length > 30) && styles.disabled]}>
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="cloud-upload-outline" size={18} color="#fff"/>}
        <Text style={styles.buttonText}>Publicar selección ({selected.length}) en Convex</Text>
      </Pressable>
    </>}
    {!!feedback && <Text style={styles.small}>{feedback}</Text>}
    {existing || lastId ? <Pressable accessibilityRole="button" style={styles.link} onPress={() => Linking.openURL(`${ORIGIN}/music-card.html?card=${encodeURIComponent(existing?.id || lastId)}`)}>
      <Ionicons name="open-outline" size={18} color="#1d4ed8"/>
      <Text style={styles.linkText}>Abrir reproductor público (requiere despliegue 3B)</Text>
    </Pressable> : null}
  </View>;
}

export default function MusicCollectionPublisher({ playlists = [] }) {
  const publishCollection = useMutation(api.publicMusicCards.publishCollection);
  const stored = useQuery(api.publicMusicCards.listMine);
  const published = Array.isArray(stored) ? stored : [];
  const collections = useMemo(() => (Array.isArray(playlists) ? playlists : []).filter(p => Array.isArray(p.tracks) && p.tracks.length > 1), [playlists]);
  if (collections.length === 0) return null;
  return <View style={styles.root}>
    <Text style={styles.heading}>Publicar selección multipista en Convex</Text>
    <Text style={styles.small}>Una publicación por playlist de origen. Las fichas individuales existentes no se modifican. No imprimas el QR hasta desplegar y verificar el reproductor multipista.</Text>
    {collections.map((playlist, i) => <PlaylistSelection key={sourceId(playlist)} playlist={playlist} published={published} publishCollection={publishCollection} />)}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 12, marginVertical: 18 },
  panel: { padding: 14, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, backgroundColor: "#fff", gap: 9 },
  heading: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  small: { color: "#64748b", fontSize: 12 },
  ok: { color: "#15803d", fontSize: 13, fontWeight: "600" },
  track: { flexDirection: "row", alignItems: "center", gap: 7, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingVertical: 8 },
  trackMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  trackText: { flex: 1, color: "#0f172a", fontSize: 13 },
  arrows: { flexDirection: "row", alignItems: "center", gap: 8 },
  button: { borderRadius: 8, backgroundColor: "#1d4ed8", padding: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  disabled: { opacity: .5 },
  buttonText: { fontWeight: "700", color: "#fff", fontSize: 13 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  linkText: { color: "#1d4ed8", fontSize: 13, fontWeight: "600" },
});
