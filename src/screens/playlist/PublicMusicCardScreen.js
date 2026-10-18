import React, { useEffect, useMemo, useRef, useState } from "react";
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
const LRC_PATH_RE = /^\/music-cards\/lyrics\/(?:shopp-[a-z0-9-]{5,63}\/\d{3}|[A-Za-z0-9_-]{1,110})\.lrc$/;
const PUBLIC_RE = /^[a-z0-9][a-z0-9-]{5,63}$/;
// Solo carátulas públicas HTTPS o rutas absolutas de la propia web.
function safeCoverUrl(raw) {
  const value = String(raw || "").trim();
  if (!value || value.length > 2048 || value.startsWith("//")) return "";
  if (/^\/(?!\/)[a-zA-Z0-9_./%-]+$/.test(value) && !value.split("/").includes("..")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}


function clean(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

export function parsePublicLrc(source) {
  const lines = [];
  for (const line of String(source || "").split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const text = line.replace(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g, "").trim();
    if (!text) continue;
    for (const match of stamps) {
      const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
      lines.push({ seconds: Number(match[1]) * 60 + Number(match[2]) + fraction, text });
    }
  }
  return lines.sort((a, b) => a.seconds - b.seconds);
}

function normalizeTrack(track) {
  const videoId = clean(track?.videoId, 120);
  const playlistId = clean(track?.playlistId, 120);
  if (VIDEO_RE.test(videoId)) {
    return {
      videoId,
      title: clean(track?.title || "Vídeo de YouTube"),
      author: clean(track?.author, 100),
      lyricsUrl: LRC_PATH_RE.test(track?.lyricsUrl || "") ? track.lyricsUrl : "",
      coverUrl: safeCoverUrl(track?.coverUrl),
    };
  }
  if (PLAYLIST_RE.test(playlistId)) {
    return {
      playlistId,
      title: clean(track?.title || "Playlist de YouTube"),
      author: clean(track?.author, 100),
      lyricsUrl: LRC_PATH_RE.test(track?.lyricsUrl || "") ? track.lyricsUrl : "",
      coverUrl: safeCoverUrl(track?.coverUrl),
    };
  }
  return null;
}

function embeddedUrl(track, autoPlay = false) {
  if (track?.videoId) {
    return `https://www.youtube-nocookie.com/embed/${track.videoId}?playsinline=1&rel=0&enablejsapi=1${autoPlay ? "&autoplay=1" : ""}`;
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
  const frameRef = useRef(null);
  const trackIndexRef = useRef(0);
  const tracksRef = useRef([]);
  const [advanceAutomatically, setAdvanceAutomatically] = useState(true);
  const [requestAutoPlay, setRequestAutoPlay] = useState(false);
  const [playbackState, setPlaybackState] = useState("unstarted"); // YouTube: playing, paused, buffering, ended
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [lrcLines, setLrcLines] = useState([]);
  const [lyricsStatus, setLyricsStatus] = useState("none");
  const [lyricsError, setLyricsError] = useState("");
  const [youtubeClockReceived, setYoutubeClockReceived] = useState(false);
  const lyricsDebug = getCardQuery()?.get("debugLrc") === "1";
  const [viewMode, setViewMode] = useState(() => {
    const mode = getCardQuery()?.get("view");
    return ["simple", "complete", "app-one", "app-two"].includes(mode) ? mode : "simple";
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
          const contentType = (response.headers.get("content-type") || "").toLowerCase();
          if (!contentType.includes("json")) throw new Error("La dirección pública devuelve HTML, no una ficha JSON de playlist.");
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
      const title = clean(query.get("t") || "Canción compartida");
      const author = clean(query.get("a"), 100);
      const track = normalizeTrack(raw ? { ...raw, title, author } : null);
      if (track) {
        setData({
          title,
          author,
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

  const appView = viewMode === "app-one" || viewMode === "app-two";
  const twoColumnApp = viewMode === "app-two" && width >= 740;
  const showTracks = viewMode === "complete" || appView;
  const currentTrack = data?.tracks?.[index];
  const embedSrc = useMemo(() => embeddedUrl(currentTrack, requestAutoPlay), [currentTrack, requestAutoPlay]);
  const currentPlaying = playbackState === "playing" || playbackState === "buffering";
  trackIndexRef.current = index;
  tracksRef.current = data?.tracks || [];

  useEffect(() => {
    setPlaybackState("unstarted");
    setPositionSeconds(0);
    setYoutubeClockReceived(false);
    setLrcLines([]);
    setLyricsError("");
    const url = currentTrack?.lyricsUrl;
    if (!url) {
      setLyricsStatus("none");
      return undefined;
    }
    setLyricsStatus("loading");
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status} al descargar ${url}`);
        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        if (contentType.includes("text/html")) throw new Error(`Se recibió HTML en vez de LRC: ${url}`);
        return response.text();
      })
      .then(content => {
        const lines = parsePublicLrc(content);
        if (!lines.length) throw new Error(`No se encontraron marcas temporales en ${url}`);
        if (!controller.signal.aborted) {
          setLrcLines(lines);
          setLyricsStatus("ready");
        }
      })
      .catch(cause => {
        if (controller.signal.aborted) return;
        setLyricsStatus("error");
        setLyricsError(cause?.message || "No se pudo descargar la letra LRC");
      });
    return () => controller.abort();
  }, [currentTrack?.lyricsUrl]);

  useEffect(() => {
    if (Platform.OS !== "web" || player !== "shopp") return undefined;
    const send = (func, args = []) => frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }), "https://www.youtube-nocookie.com");
    const handler = event => {
      if (event.source !== frameRef.current?.contentWindow ||
          !["https://www.youtube-nocookie.com", "https://www.youtube.com"].includes(event.origin)) return;
      let message;
      try { message = typeof event.data === "string" ? JSON.parse(event.data) : event.data; }
      catch { return; }
      if (message?.event === "onReady") {
        send("addEventListener", ["onStateChange"]);
      }
      if (message?.event === "infoDelivery" && Number.isFinite(message.info?.currentTime)) {
        setPositionSeconds(message.info.currentTime);
        setYoutubeClockReceived(true);
      }
      const state = message?.event === "onStateChange" ? Number(message.info) : message?.info?.playerState;
      if (Number.isFinite(state)) {
        const labels = { [-1]: "unstarted", [0]: "ended", [1]: "playing", [2]: "paused", [3]: "buffering", [5]: "cued" };
        if (labels[state]) setPlaybackState(labels[state]);
      }
      if (state === 0 && advanceAutomatically && tracksRef.current.length > trackIndexRef.current + 1) {
        setRequestAutoPlay(true);
        setIndex(trackIndexRef.current + 1);
      }
    };
    window.addEventListener("message", handler);
    const timer = window.setInterval(() => send("getCurrentTime"), 500);
    return () => { window.removeEventListener("message", handler); window.clearInterval(timer); };
  }, [player, advanceAutomatically]);

  const activeLyric = useMemo(() => {
    let line = "";
    for (const entry of lrcLines) {
      if (entry.seconds > positionSeconds) break;
      line = entry.text;
    }
    return line;
  }, [lrcLines, positionSeconds]);
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
    // Cada fila es un control Play/Pause, incluso si la playlist es pública.
    if (nextIndex === index && player === "shopp") {
      const method = currentPlaying ? "pauseVideo" : "playVideo";
      // La API IFrame controla el estado real; no suponemos éxito hasta recibir onStateChange.
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: method, args: [] }),
        "https://www.youtube-nocookie.com"
      );
      return;
    }
    setPlaybackState("unstarted");
    // Tras seleccionar una pista diferente, cargarla e intentar reproducirla.
    // El navegador puede bloquear autoplay; quedará disponible el Play oficial.
    setRequestAutoPlay(true);
    if (nextIndex !== index) setIndex(nextIndex);
    if (player !== "shopp") setPlayer("shopp");
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
                {[["simple", "Simplificado"], ["complete", "Completo"], ["app-one", "App · 1 col"], ["app-two", "App · 2 col"]].map(([value, label]) => (
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
                : viewMode === "simple" ? "Reproductor sencillo, sin mostrar la lista de canciones."
                : viewMode === "app-one" ? "Vista de Music Playlist: vídeo y lista en una columna."
                : "Vista de Music Playlist: vídeo y lista en dos columnas (una en móviles)."}</Text>
            </View>
            <View style={[
              styles.mainArea,
              (isWide && viewMode === "complete" || twoColumnApp) && styles.mainAreaWide,
              appView && styles.appArea,
              appView && !twoColumnApp && styles.appAreaStacked,
            ]}>
              <View style={[styles.playerArea, appView && styles.appPlayerArea, appView && !twoColumnApp && styles.appPlayerCentered]}>
                <View style={[styles.playerCard, appView && styles.appPlayerCard]}>
                  {player === "shopp" && embedSrc ? (
                    <>
                      {Platform.OS === "web" ? (
                        <View style={styles.videoFrame}>
                          {React.createElement("iframe", {
                            key: embedSrc,
                            src: embedSrc,
                            ref: node => {
                              frameRef.current = node;
                              if (node) node.onload = () => node.contentWindow?.postMessage(
                                JSON.stringify({ event: "listening", id: "shopp-public" }),
                                "https://www.youtube-nocookie.com");
                            },
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
                      {activeLyric ? <Text style={styles.lyricLine} numberOfLines={2}>{activeLyric}</Text> : null}
                      {lyricsStatus === "error" ? <Text style={styles.lyricsError}>No se pudieron cargar las letras. {lyricsDebug ? lyricsError : "Comprueba la publicación del LRC."}</Text> : null}
                      {lyricsDebug && <Text style={styles.lyricsDiagnostic}>
                        {`LRC: ${lyricsStatus} · ${lrcLines.length} líneas · tiempo: ${positionSeconds.toFixed(1)} s · reloj YouTube: ${youtubeClockReceived ? "OK" : "sin datos"} · URL: ${currentTrack?.lyricsUrl || "(sin lyricsUrl)"}`}
                      </Text>}
                      <View style={[styles.playerToolbar, appView && styles.appToolbar]}>
                        <View style={styles.nowPlaying}>
                          <Ionicons name={currentPlaying ? "pause-circle" : "play-circle"} size={20} color="#2563eb" />
                          <Text style={[styles.nowPlayingText, appView && styles.appText]} numberOfLines={1}>
                            {currentTrack?.title || data.title}
                          </Text>
                        </View>
                        <Pressable onPress={() => setPlayer(null)} style={styles.changeButton} accessibilityRole="button">
                          <Ionicons name="swap-horizontal" size={17} color="#2563eb" />
                          <Text style={styles.changeText}>Cambiar reproductor</Text>
                        </Pressable>
                      </View>
                      <Pressable onPress={openInYouTube} style={[styles.fallbackButton, appView && styles.appFallback]} accessibilityRole="button">
                        <Ionicons name="logo-youtube" size={18} color="#b91c1c" />
                        <Text style={styles.fallbackText}>Abrir este vídeo en YouTube</Text>
                        <Ionicons name="open-outline" size={16} color="#b91c1c" />
                      </Pressable>
                    </>
                  ) : (
                    <View style={[styles.selectionPanel, appView && styles.appSelection]}>
                      <View style={styles.musicIcon}><Ionicons name="musical-notes" size={31} color="#2563eb" /></View>
                      <Text style={[styles.selectionTitle, appView && styles.appText]}>¿Dónde quieres reproducirlo?</Text>
                      <Text style={[styles.selectionSub, appView && styles.appMuted]}>
                        {currentTrack?.title || data.title}
                      </Text>
                      <Text style={[styles.selectionHelp, appView && styles.appMuted]}>Elige cómo abrir el vídeo de YouTube.</Text>
                      <View style={styles.playerOptions}>
                        <Pressable onPress={() => { setRequestAutoPlay(false); setPlayer("shopp"); }} style={[styles.optionButton, styles.shoppOption]} accessibilityRole="button">
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
                {data.tracks.length > 1 && <Pressable
                  onPress={() => setAdvanceAutomatically(value => !value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: advanceAutomatically }}
                  style={styles.autoPlayControl}>
                  <Ionicons name={advanceAutomatically ? "checkbox" : "square-outline"} size={20} color="#2563eb" />
                  <Text style={[styles.autoPlayText, appView && styles.appText]}>Continuar con la siguiente canción automáticamente</Text>
                </Pressable>}
                {!appView && <Text style={styles.footnote}>
                  La reproducción integrada utiliza el reproductor oficial de YouTube. Algunos vídeos no permiten insertarse en otras páginas; en ese caso, ábrelos en YouTube.
                </Text>}
              </View>

              {showTracks && (appView || data.tracks.length > 1) ? (
                <View style={[styles.playlistPanel, viewMode === "complete" && isWide && styles.playlistPanelWide, appView && styles.appPlaylistPanel, twoColumnApp && styles.appPlaylistWide, appView && !twoColumnApp && styles.appPlaylistCentered]}>
                  <View style={styles.playlistHeader}>
                    <Text style={[styles.playlistHeading, appView && styles.appText]}>Canciones</Text>
                    <Text style={[styles.playlistCount, appView && styles.appMuted]}>{data.tracks.length} vídeos</Text>
                  </View>
                  {data.tracks.map((item, i) => (
                    <Pressable
                      key={`${i}-${item.videoId || item.playlistId}`}
                      onPress={() => chooseTrack(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: index === i }}
                      accessibilityLabel={`${index === i && currentPlaying && player === "shopp" ? "Pausar" : "Reproducir"} ${item.title || `Tema ${i + 1}`}`}
                      style={[styles.trackRow, index === i && styles.trackRowSelected, appView && styles.appTrackRow, appView && index === i && styles.appTrackSelected]}
                    >
                      <Text style={[styles.trackNumber, index === i && styles.trackNumberSelected, appView && styles.appMuted]}>{i + 1}</Text>
                      <View style={styles.trackDescription}>
                        <Text style={[styles.trackTitle, index === i && styles.trackTitleSelected, appView && styles.appText]} numberOfLines={2}>
                          {item.title || `Tema ${i + 1}`}
                          {item.lyricsUrl ? <Text style={styles.trackLrcIndicator} accessibilityLabel="Letras LRC disponibles">  ♪</Text> : null}
                        </Text>
                        {item.author ? <Text style={[styles.trackAuthor, appView && styles.appMuted]} numberOfLines={1}>{item.author}</Text> : null}
                      </View>
                      <Ionicons name={index === i && currentPlaying && player === "shopp" ? "pause-circle" : (index === i ? "play-circle" : "play-circle-outline")} size={22} color={appView ? (index === i ? "#ec1680" : "#9ca3af") : (index === i ? "#2563eb" : "#94a3b8")} />
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
  lyricsError: { color: "#b91c1c", fontSize: 12, padding: 8, textAlign: "center" },
  lyricsDiagnostic: { color: "#f59e0b", fontSize: 11, padding: 8, backgroundColor: "#29220f" },
  lyricLine: { paddingHorizontal: 12, paddingVertical: 7, textAlign: "center", fontSize: 14, fontStyle: "italic", color: "#eab308", backgroundColor: "#17171b" },
  autoPlayControl: { flexDirection: "row", alignItems: "center", gap: 8, padding: 9 },
  autoPlayText: { color: "#334155", fontSize: 12 },
  // Vistas de prueba inspiradas en Music Playlist; no acceden a IndexedDB ni requieren sesión.
  appArea: { backgroundColor: "#101013", padding: 15, borderRadius: 12, gap: 14 },
  appAreaStacked: { alignItems: "center" },
  appPlayerArea: { flexBasis: 0, flexGrow: 1 },
  appPlayerCentered: { width: "100%", maxWidth: 660, flexBasis: "auto" },
  appPlayerCard: { backgroundColor: "#141416", borderColor: "#28282e" },
  appToolbar: { backgroundColor: "#17171b" },
  appText: { color: "#f8fafc" },
  appMuted: { color: "#a1a1aa" },
  appFallback: { borderColor: "#34343a" },
  appSelection: { backgroundColor: "#17171b" },
  appPlaylistPanel: { backgroundColor: "#101013", borderColor: "#28282e" },
  appPlaylistWide: { width: "48%", flexShrink: 0 },
  appPlaylistCentered: { width: "100%", maxWidth: 660 },
  appTrackRow: { backgroundColor: "#19191d", borderColor: "#34343a" },
  appTrackSelected: { backgroundColor: "#291522", borderColor: "#ec1680" },
  modeSelector: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 13, marginBottom: 15, gap: 8 },
  modeTitle: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  modeButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeButton: { flexGrow: 1, flexBasis: "46%", alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1" },
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
  trackLrcIndicator: { color: "#facc15", fontSize: 13, fontWeight: "700" },
  trackAuthor: { color: "#64748b", fontSize: 12 },
});
