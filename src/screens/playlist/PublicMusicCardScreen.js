import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Ruta pública /?shoppCard=1: no requiere cuenta de Shopp, Convex ni IndexedDB.
// El contenido audiovisual se reproduce exclusivamente mediante el iframe
// oficial de YouTube o en la aplicación/sitio web de YouTube.
const VIDEO_RE = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_RE = /^[A-Za-z0-9_-]{10,120}$/;
const PUBLIC_RE = /^[a-z0-9][a-z0-9-]{5,63}$/;

function clean(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeTrack(track) {
  const videoId = clean(track?.videoId, 120);
  const playlistId = clean(track?.playlistId, 120);
  if (VIDEO_RE.test(videoId)) {
    return {
      videoId,
      title: clean(track?.title || "Vídeo de YouTube"),
      author: clean(track?.author, 100),
    };
  }
  if (PLAYLIST_RE.test(playlistId)) {
    return {
      playlistId,
      title: clean(track?.title || "Playlist de YouTube"),
      author: clean(track?.author, 100),
    };
  }
  return null;
}

function embeddedUrl(track) {
  if (track?.videoId) {
    return `https://www.youtube-nocookie.com/embed/${track.videoId}?playsinline=1&rel=0`;
  }
  if (track?.playlistId) {
    return `https://www.youtube-nocookie.com/embed/videoseries?list=${track.playlistId}&playsinline=1`;
  }
  return "";
}

function youtubeUrl(track) {
  if (track?.videoId) return `https://www.youtube.com/watch?v=${track.videoId}`;
  if (track?.playlistId) return `https://www.youtube.com/playlist?list=${track.playlistId}`;
  return "";
}

function getCardQuery() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

function isValidPublicManifest(manifest, publicId) {
  return manifest?.schema === "shopp-public-music-card" &&
    manifest?.version === 1 && manifest?.id === publicId &&
    Array.isArray(manifest.tracks);
}

export default function PublicMusicCardScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(0);
  const [player, setPlayer] = useState(null); // null: elegir; 'shopp': iframe de YouTube
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState(() => {
    const mode = getCardQuery()?.get("view");
    return mode === "complete" ? "complete" : "simple";
  });

  useEffect(() => {
    let active = true;
    const query = getCardQuery();
    if (!query) {
      setError("Esta pantalla se abre desde un navegador web.");
      setStatus("error");
      return undefined;
    }

    const publicId = query.get("p") || "";
    if (publicId) {
      if (!PUBLIC_RE.test(publicId)) {
        setError("El identificador público de la playlist no es válido.");
        setStatus("error");
        return undefined;
      }
      fetch(`/music-cards/${encodeURIComponent(publicId)}.json`, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("Playlist no publicada. Comprueba su ficha JSON en Netlify.");
          return response.json();
        })
        .then((manifest) => {
          if (!isValidPublicManifest(manifest, publicId)) {
            throw new Error("La ficha pública de la playlist no tiene un formato válido.");
          }
          const tracks = manifest.tracks.slice(0, 100).map(normalizeTrack).filter(Boolean);
          if (!tracks.length) throw new Error("La playlist no contiene vídeos de YouTube válidos.");
          if (active) {
            setData({
              title: clean(manifest.title || "Playlist Shopp"),
              author: clean(manifest.author, 100),
              tracks,
            });
            setStatus("ready");
          }
        })
        .catch((cause) => {
          if (active) {
            setError(cause?.message || "No se pudo cargar la playlist.");
            setStatus("error");
          }
        });
    } else {
      const videoId = query.get("v") || "";
      const playlistId = query.get("ytpl") || "";
      const raw = VIDEO_RE.test(videoId) ? { videoId } :
        PLAYLIST_RE.test(playlistId) ? { playlistId } : null;
      const track = normalizeTrack(raw);
      if (track) {
        setData({
          title: clean(query.get("t") || "Canción compartida"),
          author: clean(query.get("a"), 100),
          tracks: [track],
        });
        setStatus("ready");
      } else {
        setError("El enlace QR no contiene un vídeo o una playlist válida.");
        setStatus("error");
      }
    }
    return () => { active = false; };
  }, []);

  const currentTrack = data?.tracks?.[index];
  const embedSrc = useMemo(() => embeddedUrl(currentTrack), [currentTrack]);
  const externalSrc = useMemo(() => youtubeUrl(currentTrack), [currentTrack]);

  function openInYouTube() {
    if (!externalSrc) return;
    // El navegador o el sistema operativo decidirá si abre la app de YouTube.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const tab = window.open(externalSrc, "_blank", "noopener,noreferrer");
      if (!tab) window.location.assign(externalSrc);
    } else {
      Linking.openURL(externalSrc).catch(() => {});
    }
  }

  function chooseTrack(nextIndex) {
    if (nextIndex === index) return;
    setIndex(nextIndex);
    // Si se ha elegido Shopp, el iframe se actualiza al tema seleccionado.
    // Si todavía no se ha elegido, se muestran las opciones de reproductor.
  }

  function goHome() {
    if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign("/");
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.body}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}><Text style={styles.brandIconText}>S</Text></View>
            <View style={styles.brandTitles}>
              <Text style={styles.brand}>Shopp</Text>
              <Text style={styles.brandSubtitle}>Música compartida · Acceso público</Text>
            </View>
          </View>
          <Pressable onPress={goHome} style={styles.homeButton} accessibilityRole="button">
            <Ionicons name="home-outline" size={17} color="#2563eb" />
            <Text style={styles.homeText}>Ir a Shopp</Text>
          </Pressable>
        </View>

        {status === "loading" ? (
          <View style={styles.statePanel}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.notice}>Cargando música compartida…</Text>
          </View>
        ) : status === "error" ? (
          <View style={styles.statePanel}>
            <Ionicons name="alert-circle-outline" size={32} color="#b91c1c" />
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.notice}>Puedes volver a escanear el código QR o consultar a quien te entregó la tarjeta.</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>{data.tracks.length > 1 ? "PLAYLIST COMPARTIDA" : "VÍDEO COMPARTIDO"}</Text>
              <Text style={styles.title}>{data.title}</Text>
              {data.author ? <Text style={styles.author}>{data.author}</Text> : null}
              <Text style={styles.trackCount}>{data.tracks.length} {data.tracks.length === 1 ? "vídeo" : "vídeos"}</Text>
            </View>

            <View style={styles.modeSelector}>
              <Text style={styles.modeTitle}>Vista del reproductor público</Text>
              <View style={styles.modeButtons}>
                {[["simple", "Simplificado"], ["complete", "Completo"]].map(([value, label]) => (
                  <Pressable key={value} accessibilityRole="radio"
                    accessibilityState={{ selected: viewMode === value }}
                    onPress={() => {
                      setViewMode(value);
                      if (Platform.OS === "web" && typeof window !== "undefined") {
                        const url = new URL(window.location.href);
                        url.searchParams.set("view", value);
                        window.history.replaceState(null, "", url.toString());
                      }
                    }}
                    style={[styles.modeButton, viewMode === value && styles.modeButtonActive]}>
                    <Text style={[styles.modeButtonText, viewMode === value && styles.modeButtonTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.modeHint}>{viewMode === "complete"
                ? "Vídeo y lista de canciones, con selección de pistas."
                : "Reproductor sencillo, sin mostrar la lista de canciones."}</Text>
            </View>
            <View style={[styles.mainArea, isWide && viewMode === "complete" && styles.mainAreaWide]}>
              <View style={styles.playerArea}>
                <View style={styles.playerCard}>
                  {player === "shopp" && embedSrc ? (
                    <>
                      {Platform.OS === "web" ? (
                        <View style={styles.videoFrame}>
                          {React.createElement("iframe", {
                            key: embedSrc,
                            src: embedSrc,
                            title: `YouTube: ${currentTrack?.title || data.title}`,
                            allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
                            allowFullScreen: true,
                            referrerPolicy: "strict-origin-when-cross-origin",
                            style: {
                              width: "100%", height: "100%", border: 0,
                              display: "block", backgroundColor: "#0f172a",
                            },
                          })}
                        </View>
                      ) : null}
                      <View style={styles.playerToolbar}>
                        <View style={styles.nowPlaying}>
                          <Ionicons name="play-circle" size={20} color="#2563eb" />
                          <Text style={styles.nowPlayingText} numberOfLines={1}>
                            {currentTrack?.title || data.title}
                          </Text>
                        </View>
                        <Pressable onPress={() => setPlayer(null)} style={styles.changeButton} accessibilityRole="button">
                          <Ionicons name="swap-horizontal" size={17} color="#2563eb" />
                          <Text style={styles.changeText}>Cambiar reproductor</Text>
                        </Pressable>
                      </View>
                      <Pressable onPress={openInYouTube} style={styles.fallbackButton} accessibilityRole="button">
                        <Ionicons name="logo-youtube" size={18} color="#b91c1c" />
                        <Text style={styles.fallbackText}>Abrir este vídeo en YouTube</Text>
                        <Ionicons name="open-outline" size={16} color="#b91c1c" />
                      </Pressable>
                    </>
                  ) : (
                    <View style={styles.selectionPanel}>
                      <View style={styles.musicIcon}><Ionicons name="musical-notes" size={31} color="#2563eb" /></View>
                      <Text style={styles.selectionTitle}>¿Dónde quieres reproducirlo?</Text>
                      <Text style={styles.selectionSub}>
                        {currentTrack?.title || data.title}
                      </Text>
                      <Text style={styles.selectionHelp}>Elige cómo abrir el vídeo de YouTube.</Text>
                      <View style={styles.playerOptions}>
                        <Pressable onPress={() => setPlayer("shopp")} style={[styles.optionButton, styles.shoppOption]} accessibilityRole="button">
                          <Ionicons name="play-circle-outline" size={25} color="#ffffff" />
                          <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitleOnBlue}>Reproducir en Shopp</Text>
                            <Text style={styles.optionSubtitleOnBlue}>Sin salir de esta pantalla</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={21} color="#ffffff" />
                        </Pressable>
                        <Pressable onPress={openInYouTube} style={[styles.optionButton, styles.youtubeOption]} accessibilityRole="button">
                          <Ionicons name="logo-youtube" size={25} color="#dc2626" />
                          <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitle}>Abrir en YouTube</Text>
                            <Text style={styles.optionSubtitle}>App de YouTube o navegador</Text>
                          </View>
                          <Ionicons name="open-outline" size={19} color="#475569" />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
                <Text style={styles.footnote}>
                  La reproducción integrada utiliza el reproductor oficial de YouTube. Algunos vídeos no permiten insertarse en otras páginas; en ese caso, ábrelos en YouTube.
                </Text>
              </View>

              {viewMode === "complete" && data.tracks.length > 1 ? (
                <View style={[styles.playlistPanel, isWide && styles.playlistPanelWide]}>
                  <View style={styles.playlistHeader}>
                    <Text style={styles.playlistHeading}>Canciones</Text>
                    <Text style={styles.playlistCount}>{data.tracks.length} vídeos</Text>
                  </View>
                  {data.tracks.map((item, i) => (
                    <Pressable
                      key={`${i}-${item.videoId || item.playlistId}`}
                      onPress={() => chooseTrack(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: index === i }}
                      style={[styles.trackRow, index === i && styles.trackRowSelected]}
                    >
                      <Text style={[styles.trackNumber, index === i && styles.trackNumberSelected]}>{i + 1}</Text>
                      <View style={styles.trackDescription}>
                        <Text style={[styles.trackTitle, index === i && styles.trackTitleSelected]} numberOfLines={2}>
                          {item.title || `Tema ${i + 1}`}
                        </Text>
                        {item.author ? <Text style={styles.trackAuthor} numberOfLines={1}>{item.author}</Text> : null}
                      </View>
                      <Ionicons name={index === i ? "play-circle" : "play-circle-outline"} size={22} color={index === i ? "#2563eb" : "#94a3b8"} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modeSelector: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 13, marginBottom: 15, gap: 8 },
  modeTitle: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  modeButtons: { flexDirection: "row", gap: 8 },
  modeButton: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1" },
  modeButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  modeButtonText: { color: "#334155", fontWeight: "700" },
  modeButtonTextActive: { color: "#fff" },
  modeHint: { color: "#64748b", fontSize: 12 },
  page: { flex: 1, backgroundColor: "#f1f5f9" },
  body: { minHeight: "100%", paddingHorizontal: 16, paddingVertical: 22, alignItems: "center" },
  container: { width: "100%", maxWidth: 1160, gap: 17 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  brandIcon: { width: 43, height: 43, borderRadius: 11, backgroundColor: "#2563eb", justifyContent: "center", alignItems: "center" },
  brandIconText: { color: "#fff", fontSize: 26, fontWeight: "900" },
  brandTitles: { flexShrink: 1 },
  brand: { color: "#2563eb", fontWeight: "900", fontSize: 21 },
  brandSubtitle: { color: "#64748b", fontSize: 12 },
  homeButton: { flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 9, paddingHorizontal: 11, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, backgroundColor: "#fff" },
  homeText: { color: "#2563eb", fontSize: 12, fontWeight: "700" },
  statePanel: { backgroundColor: "#fff", borderRadius: 14, padding: 40, alignItems: "center", gap: 15 },
  error: { color: "#b91c1c", fontWeight: "700", textAlign: "center", fontSize: 16 },
  notice: { color: "#64748b", textAlign: "center" },
  header: { gap: 4, paddingVertical: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.1, color: "#2563eb", fontWeight: "800" },
  title: { fontSize: 27, fontWeight: "800", color: "#0f172a" },
  author: { fontSize: 16, fontWeight: "600", color: "#475569" },
  trackCount: { color: "#64748b", marginTop: 2, fontSize: 13 },
  mainArea: { gap: 16 },
  mainAreaWide: { flexDirection: "row", alignItems: "flex-start" },
  playerArea: { minWidth: 0, flexGrow: 1, flexShrink: 1, gap: 8 },
  playerCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, overflow: "hidden" },
  videoFrame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#0f172a" },
  playerToolbar: { padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  nowPlaying: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  nowPlayingText: { color: "#0f172a", fontWeight: "700", fontSize: 14, flexShrink: 1 },
  changeButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 8, backgroundColor: "#eff6ff" },
  changeText: { color: "#2563eb", fontSize: 12, fontWeight: "700" },
  fallbackButton: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", padding: 12, borderTopWidth: 1, borderColor: "#e2e8f0" },
  fallbackText: { color: "#b91c1c", fontWeight: "700", fontSize: 13 },
  selectionPanel: { paddingHorizontal: 18, paddingVertical: 27, alignItems: "center", gap: 8 },
  musicIcon: { height: 58, width: 58, backgroundColor: "#eff6ff", borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  selectionTitle: { fontSize: 21, fontWeight: "800", textAlign: "center", color: "#0f172a" },
  selectionSub: { color: "#475569", fontSize: 15, textAlign: "center", fontWeight: "600" },
  selectionHelp: { color: "#64748b", fontSize: 13, textAlign: "center", marginBottom: 10 },
  playerOptions: { width: "100%", maxWidth: 460, gap: 10 },
  optionButton: { borderRadius: 12, minHeight: 66, paddingVertical: 12, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  shoppOption: { backgroundColor: "#2563eb" },
  youtubeOption: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1" },
  optionTextContainer: { flex: 1, minWidth: 0 },
  optionTitleOnBlue: { color: "#fff", fontSize: 15, fontWeight: "800" },
  optionSubtitleOnBlue: { color: "#dbeafe", fontSize: 12, marginTop: 2 },
  optionTitle: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  optionSubtitle: { color: "#64748b", fontSize: 12, marginTop: 2 },
  footnote: { fontSize: 12, lineHeight: 17, color: "#64748b", textAlign: "center", paddingHorizontal: 6 },
  playlistPanel: { width: "100%", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", padding: 11, gap: 6 },
  playlistPanelWide: { width: 350, flexShrink: 0 },
  playlistHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, paddingHorizontal: 4 },
  playlistHeading: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  playlistCount: { color: "#64748b", fontSize: 12 },
  trackRow: { flexDirection: "row", gap: 11, alignItems: "center", backgroundColor: "#f8fafc", paddingVertical: 12, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: "#e2e8f0" },
  trackRowSelected: { backgroundColor: "#eff6ff", borderColor: "#2563eb" },
  trackNumber: { color: "#64748b", fontWeight: "700", width: 21, textAlign: "center" },
  trackNumberSelected: { color: "#2563eb" },
  trackDescription: { flex: 1, minWidth: 0, gap: 3 },
  trackTitle: { color: "#1e293b", fontWeight: "700", fontSize: 14 },
  trackTitleSelected: { color: "#1d4ed8" },
  trackAuthor: { color: "#64748b", fontSize: 12 },
});
