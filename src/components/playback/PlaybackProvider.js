import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { I18nText as Text, tr } from "@/src/i18n";
import YouTubeSurface from "./YouTubeSurface";
import { formatTime, normalizeTrack, parseLrc } from "./youtubeUtils";
import { getLocalLyrics } from "@/src/storage/lyricsStorage";

const PlaybackContext = createContext(null);
// Cambia este valor para alternar entre los dos diseños disponibles:
// Ambas variantes conservan los repartos de espacio preparados anteriormente.
// Los controles de volumen no se muestran en la card.
const PLAYBACK_CARD_LAYOUT = "volumeInControls";
const EMPTY_STATUS = {
  state: -1,
  time: 0,
  duration: 0,
  ready: false,
  videoIds: [],
  playlistIndex: 0,
};
const trackKey = (item) =>
  `${item?.kind || "single"}:${item?.videoId || item?.playlistId || item?.url || ""}`;
// Avenir Next is the typeface used by the reference card. The web fallback
// stack and Android's light sans-serif keep a similar geometric appearance.
const CARD_FONT = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif-light",
  web: "Avenir Next, Avenir, Century Gothic, Helvetica Neue, sans-serif",
  default: undefined,
});
export function usePlayback() {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("PlaybackProvider is required");
  return value;
}
function IconButton({ name, label, onPress, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, disabled && styles.disabled]}
    >
      <Ionicons name={name} size={23} color="#e5e7eb" />
    </Pressable>
  );
}

function SyncedLyricLine({ track, uri, time, compact = false }) {
  const [lines, setLines] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setLines([]);
    (async () => {
      try {
        const local = await getLocalLyrics(track);
        if (cancelled) return;
        if (local?.text != null) {
          setLines(parseLrc(local.text));
          return;
        }
        if (uri) {
          const response = await fetch(uri);
          const source = response.ok ? await response.text() : "";
          if (!cancelled) setLines(parseLrc(source));
        }
      } catch {
        if (!cancelled && uri) {
          fetch(uri)
            .then((r) => (r.ok ? r.text() : ""))
            .then((source) => {
              if (!cancelled) setLines(parseLrc(source));
            })
            .catch(() => {});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track?.videoId, track?.playlistId, track?.url, track?.lyricsKey, track?.lyricsDisabled, uri]);
  if (!lines.length) return null;
  let index = -1;
  lines.forEach((line, i) => {
    if (line.time <= time + 0.08) index = i;
  });
  const text = index >= 0 ? lines[index]?.text : null;
  if (!text) return null;
  return (
    <View style={styles.cardLyric}>
      <Ionicons name="musical-notes-outline" size={14} color="#dc2626" />
      <Text
        style={[styles.cardLyricText, compact && styles.cardLyricTextMobile]}
        numberOfLines={2}
      >
        {text}
      </Text>
    </View>
  );
}


function trackHasLyricsReference(track) {
  if (track?.lyricsDisabled === true) return false;
  return Boolean(
    track?.lyricsFileName ||
      track?.lyricsStorageId ||
      track?.lyricsUri ||
      track?.lyricsUrl ||
      track?.lyricsKey ||
      track?.hasLyrics,
  );
}

function LyricsAvailabilityMark({ track }) {
  const [available, setAvailable] = useState(trackHasLyricsReference(track));

  useEffect(() => {
    let cancelled = false;
    const initial = trackHasLyricsReference(track);
    setAvailable(initial);
    if (initial) return () => {
      cancelled = true;
    };
    (async () => {
      try {
        const local = await getLocalLyrics(track);
        if (!cancelled && String(local?.text || "").trim()) {
          setAvailable(true);
        }
      } catch {
        // Si no hay letra local, la marca no se muestra.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    track?.videoId,
    track?.playlistId,
    track?.url,
    track?.lyricsFileName,
    track?.lyricsStorageId,
    track?.lyricsUri,
    track?.lyricsUrl,
    track?.lyricsKey,
    track?.lyricsDisabled,
    track?.hasLyrics,
  ]);

  if (!available) return null;

  return (
    <View style={styles.lyricsMark}>
      <Ionicons name="musical-note" size={10} color="#facc15" />
    </View>
  );
}

function QueueLyricsPreview({ track, uri, time }) {
  const [lines, setLines] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setLines([]);
    (async () => {
      try {
        const local = await getLocalLyrics(track);
        if (cancelled) return;
        if (local?.text != null) {
          setLines(parseLrc(local.text));
          return;
        }
        if (uri) {
          const response = await fetch(uri);
          const source = response.ok ? await response.text() : "";
          if (!cancelled) {
            setLines(parseLrc(source));
          }
        }
      } catch {
        // Una letra inaccesible no genera ningún aviso dentro de la pista.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track?.videoId, track?.playlistId, track?.url, track?.lyricsKey, track?.lyricsDisabled, uri]);

  let activeIndex = -1;
  lines.forEach((line, i) => {
    if (line.time <= time + 0.08) activeIndex = i;
  });
  const currentLine = activeIndex >= 0 ? lines[activeIndex] : null;
  // Sin líneas LRC válidas, la tarjeta mantiene su altura normal.
  if (!lines.length || !currentLine?.text?.trim()) return null;

  return (
    <View style={styles.queueLyricsBox}>
      <Text style={styles.queueLyricsCurrent} numberOfLines={1}>
        {currentLine?.text || ""}
      </Text>
    </View>
  );
}

// Una sola línea LRC, situada inmediatamente debajo de YouTube.
function LyricsBelowVideo({ track, uri, time, containerStyle }) {
  const [lines, setLines] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setLines([]);
    (async () => {
      try {
        const local = await getLocalLyrics(track);
        let content = local?.text;
        if (content == null && uri) {
          const response = await fetch(uri);
          content = response.ok ? await response.text() : "";
        }
        if (!cancelled) setLines(parseLrc(content || ""));
      } catch {
        if (!cancelled) setLines([]);
      }
    })();
    return () => { cancelled = true; };
  }, [track?.videoId, track?.playlistId, track?.url, track?.lyricsKey, track?.lyricsDisabled, uri]);

  // No anticipar la primera línea: antes de su marca no hay letra activa.
  let currentLine = null;
  for (const line of lines) {
    if (line.time > time + 0.08) break;
    currentLine = line;
  }
  if (!currentLine?.text?.trim()) return null;
  return (
    <View style={[styles.lyricStripBelowVideo, containerStyle]}>
      <Text style={styles.lyricTextBelowVideo} numberOfLines={1} ellipsizeMode="tail">
        {currentLine.text}
      </Text>
    </View>
  );
}

function DesktopLyricsPanel({ track, uri, time, title }) {
  const [lines, setLines] = useState([]);
  const [hasSource, setHasSource] = useState(Boolean(uri));
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setLines([]);
    setHasSource(Boolean(uri));
    setLoading(true);
    (async () => {
      try {
        const local = await getLocalLyrics(track);
        if (cancelled) return;
        if (local?.text != null) {
          setHasSource(true);
          setLines(parseLrc(local.text));
          return;
        }
        if (uri) {
          const response = await fetch(uri);
          const source = response.ok ? await response.text() : "";
          if (!cancelled) {
            setHasSource(true);
            setLines(parseLrc(source));
          }
        }
      } catch {
        if (!cancelled) setHasSource(Boolean(uri));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track?.videoId, track?.playlistId, track?.url, track?.lyricsKey, track?.lyricsDisabled, uri]);
  let activeIndex = -1;
  lines.forEach((line, i) => {
    if (line.time <= time + 0.08) activeIndex = i;
  });
  useEffect(() => {
    if (activeIndex < 0) return;
    scrollRef.current?.scrollTo?.({
      y: Math.max(0, activeIndex * 34 - 150),
      animated: true,
    });
  }, [activeIndex]);
  return (
    <View style={styles.desktopLyricsPanel}>
      <View style={styles.desktopLyricsHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.desktopLyricsEyebrow}>LETRA</Text>
          <Text style={styles.desktopLyricsTitle} numberOfLines={2}>
            {title || "Letra"}
          </Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.desktopLyricsEmpty}>
          <Text style={styles.desktopLyricsEmptyText}>Cargando letra…</Text>
        </View>
      ) : !hasSource ? (
        <View style={styles.desktopLyricsEmpty}>
          <Ionicons name="musical-notes-outline" size={28} color="#52525b" />
          <Text style={styles.desktopLyricsEmptyTitle}>
            La letra no está disponible
          </Text>
          <Text style={styles.desktopLyricsEmptyText}>
            No hay letra para esta canción.
          </Text>
        </View>
      ) : !lines.length ? (
        <View style={styles.desktopLyricsEmpty}>
          <Text style={styles.desktopLyricsEmptyText}>No se encontraron líneas LRC con marcas de tiempo.</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.desktopLyricsScroll}
          contentContainerStyle={styles.desktopLyricsContent}
          showsVerticalScrollIndicator={false}
        >
          {lines.map((line, i) => (
            <Text
              key={`${line.time}:${i}`}
              style={[
                styles.desktopLyricLine,
                i === activeIndex && styles.desktopLyricLineActive,
              ]}
            >
              {line.text}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function PlaybackProvider({ children }) {
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const [expanded, setExpanded] = useState(true);
  // Desktop layout: one vertical column or two side-by-side columns.
  const [desktopColumns, setDesktopColumns] = useState(2);
  // Tamaño del vídeo cuando usamos el layout de una sola columna.
  const [desktopVideoSize, setDesktopVideoSize] = useState("medium");
  const [repeat, setRepeat] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [volume, setVolume] = useState(100);
  const trackVolumes = useRef(new Map());
  const [status, setStatus] = useState(EMPTY_STATUS);
  const statusRef = useRef(EMPTY_STATUS);
  const player = useRef(null);
  const serial = useRef(0);
  const autoPlayAttempt = useRef(null);
  const rememberedPlayback = useRef(new Map());
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Altura real del panel derecho y posición vertical de la cola. En escritorio
  // a dos columnas esto permite que la lista llegue exactamente hasta el borde
  // inferior disponible, sin depender de una resta fija de píxeles.
  const installSession = useCallback((value) => {
    // The keyed surface destroys the old iframe/WebView before creating the next one.
    const next = value ? { ...value, requestId: ++serial.current } : null;
    player.current?.pause();
    sessionRef.current = next;
    statusRef.current = EMPTY_STATUS;
    setStatus(EMPTY_STATUS);
    setSession(next);
  }, []);
  const rememberCurrentPlayback = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const item = current.tracks?.[current.index];
    if (!item) return;
    const currentStatus = statusRef.current;
    rememberedPlayback.current.set(trackKey(item), {
      time: currentStatus.state === 0 ? 0 : currentStatus.time || 0,
      duration: currentStatus.duration || 0,
      playlistIndex: currentStatus.playlistIndex || 0,
    });
  }, []);
  const open = useCallback(
    (playlist, { isTutorial = false } = {}) => {
      // Music/Classical PWA reproduce exclusivamente LRC locales. Aunque
      // una colección migrada conserve URLs antiguas de almacenamiento Convex,
      // no se descargan durante la reproducción habitual.
      const localCollection = Platform.OS === "web" &&
        ["playlist", "classical"].includes(playlist?.collectionType);
      const tracks = (playlist?.tracks || [])
        .map(track => localCollection
          ? { ...track, lyricsUri: undefined, lyricsUrl: undefined }
          : track)
        .map(normalizeTrack)
        .filter(Boolean);
      if (!tracks.length) return;
      const sourceKey = JSON.stringify([
        playlist._id || playlist.title,
        tracks,
      ]);
      if (sessionRef.current?.sourceKey !== sourceKey) {
        rememberCurrentPlayback();
        const remembered = rememberedPlayback.current.get(trackKey(tracks[0]));
        setVolume(trackVolumes.current.get(trackKey(tracks[0])) ?? 100);
        installSession({
          title: playlist.title || "YouTube",
          tracks,
          index: 0,
          isTutorial,
          sourceKey,
          resumeTime: 0,
          resumePlaylistIndex: 0,
          autoPlay: false,
        });
      }
      setExpanded(true);
    },
    [installSession, rememberCurrentPlayback],
  );
  const stop = useCallback(() => {
    rememberCurrentPlayback();
    installSession(null);
  }, [installSession, rememberCurrentPlayback]);
  const context = useMemo(() => ({ open, stop }), [open, stop]);
  useEffect(() => {
    if (!session || !expanded) return undefined;
    if (Platform.OS === "web") {
      const onKey = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setExpanded(false);
        }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setExpanded(false);
        return true;
      },
    );
    return () => subscription.remove();
  }, [Boolean(session), expanded]);
  const track = session?.tracks[session.index];
  const lyricsUri = track?.lyricsUri || track?.lyricsUrl;
  const select = (index) => {
    if (index === session.index) {
      playing ? player.current?.pause() : player.current?.play();
      return;
    }
    rememberCurrentPlayback();
    const remembered = rememberedPlayback.current.get(
      trackKey(session.tracks[index]),
    );
    setVolume(trackVolumes.current.get(trackKey(session.tracks[index])) ?? 100);
    installSession({
      ...session,
      index,
      resumeTime: 0,
      resumePlaylistIndex: 0,
      autoPlay: true,
    });
  };
  const ids = status.videoIds || [];
  const albumIndex = status.playlistIndex || 0;
  // Responsive breakpoints: iPad/tablets get their own layout instead of
  // jumping between the phone and desktop designs when the device rotates.
  // Al reducir el umbral a 1050 px, Chrome entraba en el layout de
  // escritorio con una ventana demasiado estrecha y solapaba la lista con
  // la cabecera. Reservamos ese layout para ventanas web amplias.
  const desktopBreakpoint = Platform.OS === "web" ? 1280 : 1200;
  const tablet = expanded && width >= 768 && width < desktopBreakpoint;
  const desktop = expanded && width >= desktopBreakpoint;
  // El selector también se ofrece en la ventana de laptop, pero en ese rango
  // se usa el layout de tableta (más estable en Chrome), NO el de escritorio.
  const tabletColumnSelector = Platform.OS === "web" && tablet && width >= 950;
  const showColumnSelector = desktop || tabletColumnSelector;
  // Chrome puede entrar en el rango "tableta" pese a ser una ventana de laptop.
  // En 1 columna necesita la misma anchura centrada y un scroll de lista real.
  const tabletOneColumn = tabletColumnSelector && desktopColumns === 1;
  const tabletLandscape = tablet && width > height &&
    (!tabletColumnSelector || desktopColumns === 2);
  const tabletPortrait = tablet && !tabletLandscape;
  // El iPad en vertical tiene bastante anchura, pero la altura debe
  // compartirse entre el vídeo fijo y la cola desplazable. Aplicamos este
  // ajuste exclusivamente en vertical: no cambia el layout horizontal.
  const ipadPortrait = tablet && height > width;
  // En iPad vertical la botonera de tamaño utiliza los mismos tres valores
  // que en escritorio. Conservamos el tamaño "medium" de la versión anterior
  // y acotamos el vídeo para que la cola siga disponiendo de scroll propio.
  const ipadPortraitSizeConfig = {
    small: { heightFactor: 0.20, minWidth: 300 },
    medium: { heightFactor: 0.275, minWidth: 390 },
    large: { heightFactor: 0.33, minWidth: 440 },
  };
  const ipadPortraitVideoConfig =
    ipadPortraitSizeConfig[desktopVideoSize] || ipadPortraitSizeConfig.medium;
  const ipadPortraitVideoWidth = ipadPortrait
    ? Math.min(
        Math.max(320, width - 48),
        720,
        Math.max(
          ipadPortraitVideoConfig.minWidth,
          (height * ipadPortraitVideoConfig.heightFactor * 16) / 9,
        ),
      )
    : null;
  const mediaLayout = desktop || tablet;
  const oneColumnDesktop = desktop && desktopColumns === 1;
  const twoColumnDesktop = desktop && desktopColumns === 2;
  const oneColumnLayout = oneColumnDesktop || tabletOneColumn;
  // En iPad vertical y en los diseños de una columna, el vídeo queda fijo
  // y la cola es el único ScrollView. Evitamos scrolls verticales anidados:
  // Safari y Chrome iOS difieren cuando un ScrollView externo contiene otro.
  // En iPhone seguimos con el diseño móvil (vídeo fijo + lista desplazable).
  const fixedVideoColumn = mediaLayout && (oneColumnLayout || tabletPortrait);
  const queueHasOwnScroll = fixedVideoColumn;

  // El reproductor compartido conserva controles compactos y de tamaño fijo.
  // El ancho de la columna puede crecer con la ventana, pero las imágenes,
  // tipografías e iconos no deben saltar a una escala desproporcionada.
  const wideTransport = false;
  const miniWidth = Math.min(360, Math.max(200, width - 16));
  // Evita que la cola quede limitada a cinco filas cuando el reproductor
  // dispone de más alto. El listado conserva su propio scroll al llenarse.
  // Altura útil de la lista. En 2 columnas dejamos que la lista aproveche
  // prácticamente toda la altura disponible de la ventana; en 1 columna
  // limitamos algo más la lista porque comparte el eje vertical con el vídeo.
  const queueRowsMaxHeight = tabletLandscape
    ? Math.max(300, height - insets.top - insets.bottom - 170)
    : tabletPortrait
      ? Math.max(260, height - insets.top - insets.bottom - 470)
      : twoColumnDesktop
        ? Math.max(320, height - insets.top - insets.bottom - 118)
        : oneColumnDesktop
          ? Math.max(260, height - insets.top - insets.bottom - 500)
          : Math.max(220, height - insets.top - insets.bottom - 620);

  // En escritorio a 2 columnas NO calculamos una altura fija para la cola.
  // El body ya tiene una altura acotada (expandedBody: flex: 1), por lo que
  // dejamos que la cola consuma por flex todo el alto restante del panel derecho.

  // En una sola columna el usuario puede elegir el tamaño del vídeo.
  // El ancho se usa también para centrar y dimensionar la lista de pistas,
  // de forma que vídeo y ScrollView queden visualmente alineados.
  const oneColumnVideoSizeMap = {
    small: { factor: 0.46, min: 500, max: 620 },
    medium: { factor: 0.56, min: 580, max: 760 },
    large: { factor: 0.66, min: 660, max: 900 },
  };
  const oneColumnVideoConfig =
    oneColumnVideoSizeMap[desktopVideoSize] || oneColumnVideoSizeMap.medium;
  const oneColumnVideoWidth = Math.min(
    oneColumnVideoConfig.max,
    Math.max(
      oneColumnVideoConfig.min,
      Math.min(width - 96, width * oneColumnVideoConfig.factor),
    ),
    // En ventanas bajas (iPad apaisado o laptop), reservamos altura para
    // al menos varias canciones sin deformar la proporción 16:9 del vídeo.
    Math.max(360, (height * 0.44 * 16) / 9),
  );
  const bottom =
    Platform.OS === "web"
      ? "calc(78px + env(safe-area-inset-bottom, 0px))"
      : 70 + Math.max(insets.bottom, 10);
  const playing = status.state === 1 || status.state === 3;
  useEffect(() => {
    if (
      !session?.autoPlay ||
      !status.ready ||
      status.error ||
      autoPlayAttempt.current === session.requestId
    ) {
      return;
    }
    autoPlayAttempt.current = session.requestId;
    // Respalda el autoarranque del adaptador web/nativo cuando la nueva
    // superficie queda lista antes de completar la reclamación exclusiva.
    player.current?.play();
  }, [session?.autoPlay, session?.requestId, status.error, status.ready]);
  const stopCurrentTrack = useCallback(() => {
    const current = sessionRef.current;
    const currentTrack = current?.tracks?.[current.index];
    player.current?.pause();
    player.current?.seek(0);
    if (currentTrack) {
      rememberedPlayback.current.set(trackKey(currentTrack), {
        time: 0,
        duration: statusRef.current.duration || 0,
        playlistIndex: statusRef.current.playlistIndex || 0,
      });
    }
    const nextStatus = { ...statusRef.current, state: 2, time: 0 };
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);
  const selectRelative = (direction) => {
    if (!session?.tracks?.length) return;
    if (shuffle && session.tracks.length > 1) {
      let next = session.index;
      while (next === session.index)
        next = Math.floor(Math.random() * session.tracks.length);
      select(next);
      return;
    }
    select(
      (session.index + direction + session.tracks.length) %
        session.tracks.length,
    );
  };
  useEffect(() => {
    if (!session || status.state !== 0) return;
    if (repeat) {
      player.current?.seek(0);
      player.current?.play();
    } else if (autoNext && session.tracks.length > 1) {
      selectRelative(1);
    }
  }, [status.state]);
  const currentTitle =
    track?.kind === "album" ? status.videoTitle || track.title : track?.title;
  const openExternal = async () => {
    player.current?.pause();
    const id = status.videoId || track.videoId;
    const url = id
      ? `https://www.youtube.com/watch?v=${id}`
      : `https://www.youtube.com/playlist?list=${track.playlistId}`;
    try {
      await Linking.openURL(url);
    } catch {
      setStatus((value) => ({ ...value, error: "No se pudo abrir YouTube." }));
    }
  };
  const openTrackExternal = async (item, active = false) => {
    player.current?.pause();
    const videoId = active ? status.videoId || item.videoId : item.videoId;
    const url = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : `https://www.youtube.com/playlist?list=${item.playlistId}`;
    try {
      await Linking.openURL(url);
    } catch {
      setStatus((value) => ({ ...value, error: "No se pudo abrir YouTube." }));
    }
  };
  const playerSurfaceProps = session
    ? {
        ref: player,
        track,
        initialTime: session.resumeTime || 0,
        initialPlaylistIndex: session.resumePlaylistIndex || 0,
        autoPlay: Boolean(session.autoPlay),
        initialVolume: volume,
        onStatus: (next) => {
          if (sessionRef.current?.requestId !== session.requestId) return;
          const mergedStatus = { ...statusRef.current, ...next };
          statusRef.current = mergedStatus;
          if (Number.isFinite(next.time)) {
            rememberedPlayback.current.set(trackKey(track), {
              time: mergedStatus.state === 0 ? 0 : mergedStatus.time || 0,
              duration: mergedStatus.duration || 0,
              playlistIndex: mergedStatus.playlistIndex || 0,
            });
          }
          setStatus(mergedStatus);
        },
      }
    : null;

  // En escritorio a 2 columnas evitamos un ScrollView exterior.
  // En react-native-web, un ScrollView anidado como contenedor del panel
  // derecho puede colapsar su contentContainer a la altura del contenido y
  // dejar una franja vacía debajo. Un View normal permite que flex: 1 se
  // propague desde expandedBody hasta la lista de pistas.
  // En todos los modos de una columna (incluido iPad vertical), el panel
  // exterior es View y la lista interna es el único ScrollView.
  // En dos columnas se conserva el comportamiento que ya funciona.
  const TrackPaneComponent = twoColumnDesktop || fixedVideoColumn ? View : ScrollView;
  const QueueRowsComponent = queueHasOwnScroll ? ScrollView : View;

  // DIAGNÓSTICO TEMPORAL DEL LAYOUT
  // Mide la cadena vertical completa para localizar exactamente dónde se
  // pierde altura en el modo escritorio de 2 columnas. El prefijo permite
  // filtrar fácilmente la consola de Chrome por "PlaybackLayout".
  const logLayout = useCallback((name) => (event) => {
    if (Platform.OS !== "web" || !expanded || !twoColumnDesktop) return;
    const { x, y, width: layoutWidth, height: layoutHeight } =
      event.nativeEvent.layout;
    console.log(`[PlaybackLayout] ${name}`, {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(layoutWidth),
      height: Math.round(layoutHeight),
      windowWidth: Math.round(width),
      windowHeight: Math.round(height),
    });
  }, [expanded, twoColumnDesktop, width, height]);

  useEffect(() => {
    if (Platform.OS !== "web" || !expanded || !twoColumnDesktop) return;
    console.log("[PlaybackLayout] viewport", {
      windowWidth: Math.round(width),
      windowHeight: Math.round(height),
      insetTop: Math.round(insets.top),
      insetBottom: Math.round(insets.bottom),
      queueRowsMaxHeight: Math.round(queueRowsMaxHeight),
    });
  }, [
    expanded,
    twoColumnDesktop,
    width,
    height,
    insets.top,
    insets.bottom,
    queueRowsMaxHeight,
  ]);

  // Las pistas individuales de los álbumes clásicos también deben formar
  // parte del mismo scroll cuando el vídeo permanece fijo en una columna.
  const albumVideoRows = track?.kind === "album" && ids.length > 0 ? (
    <View style={styles.albumVideos}>
      <Text style={styles.trackTitle}>Vídeos de {track.title}</Text>
      {ids.map((id, index) => (
        <Pressable
          key={`${id}:${index}`}
          onPress={() => player.current?.selectVideo(index)}
          accessibilityRole="button"
          accessibilityLabel={`Reproducir vídeo ${index + 1}`}
          style={[
            styles.track,
            styles.albumVideoRow,
            index === albumIndex && styles.activeTrack,
          ]}
        >
          <Image
            source={{ uri: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` }}
            style={styles.thumbnail}
          />
          <Text style={styles.trackText}>
            {index === albumIndex && status.videoTitle
              ? status.videoTitle
              : `Vídeo ${index + 1}`}
          </Text>
        </Pressable>
      ))}
    </View>
  ) : null;

  return (
    <PlaybackContext.Provider value={context}>
      <View style={styles.root}>
        {children}
        {session ? (
          <View
            accessibilityViewIsModal={expanded}
            style={[
              styles.player,
              expanded
                ? [
                    styles.expanded,
                    { paddingTop: insets.top, paddingBottom: insets.bottom },
                  ]
                : [
                    styles.mini,
                    {
                      width: miniWidth,
                      bottom,
                      maxHeight: Math.max(
                        220,
                        height - 100 - insets.top - insets.bottom,
                      ),
                    },
                  ],
            ]}
          >
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr(
                  expanded ? "Minimizar reproductor" : "Ampliar reproductor",
                )}
                onPress={() => setExpanded((value) => !value)}
                style={styles.heading}
              >
                {expanded && desktop ? (
                  <View style={styles.headerPlaylistTitle}>
                    <Text style={styles.headerPlaylistEyebrow}>
                      {session.isTutorial ? "TUTORIALES" : "PLAY LIST"}
                    </Text>
                    <Text numberOfLines={1} style={styles.title}>
                      {session.title}
                    </Text>
                  </View>
                ) : (
                  <Text numberOfLines={1} style={styles.title}>
                    {expanded ? session.title : currentTitle || session.title}
                  </Text>
                )}
              </Pressable>
              {!expanded ? (
                <IconButton
                  name={playing ? "pause" : "play"}
                  label={tr(
                    playing
                      ? `Pausar ${currentTitle || session.title}`
                      : `Reproducir ${currentTitle || session.title}`,
                  )}
                  disabled={!status.ready || Boolean(status.error)}
                  onPress={() =>
                    playing ? player.current?.pause() : player.current?.play()
                  }
                />
              ) : null}
              {expanded && session.tracks.length > 1 ? (
                <View style={[styles.headerPlaybackOptions, width < 600 && styles.headerPlaybackOptionsMobile]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Repetir una canción"
                    accessibilityState={{ selected: repeat }}
                    onPress={() => setRepeat(value => !value)}
                    style={[styles.headerPlaybackOption, width < 600 && styles.headerPlaybackOptionMobile, repeat && styles.headerPlaybackOptionActive]}
                  >
                    <Ionicons name="repeat" size={18} color={repeat ? "#f9a8d4" : "#d4d4d8"} />
                    <Text style={[styles.headerPlaybackOptionText, repeat && styles.headerPlaybackOptionTextActive]}>1</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Pasar automáticamente a la siguiente canción"
                    accessibilityState={{ selected: autoNext }}
                    onPress={() => setAutoNext(value => !value)}
                    style={[styles.headerPlaybackOption, width < 600 && styles.headerPlaybackOptionMobile, autoNext && styles.headerPlaybackOptionActive]}
                  >
                    <Ionicons name="play-skip-forward-outline" size={18} color={autoNext ? "#f9a8d4" : "#d4d4d8"} />
                    {width >= 600 ? <Text style={[styles.headerPlaybackOptionText, autoNext && styles.headerPlaybackOptionTextActive]}>Next</Text> : null}
                  </Pressable>
                </View>
              ) : null}
              {showColumnSelector ? (
                <View style={styles.desktopColumnSelector}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mostrar una columna"
                    accessibilityState={{ selected: desktopColumns === 1 }}
                    onPress={() => setDesktopColumns(1)}
                    style={[
                      styles.desktopColumnSelectorButton,
                      desktopColumns === 1 && styles.desktopColumnSelectorButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.desktopColumnSelectorText,
                        desktopColumns === 1 && styles.desktopColumnSelectorTextActive,
                      ]}
                    >
                      1 col
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mostrar dos columnas"
                    accessibilityState={{ selected: desktopColumns === 2 }}
                    onPress={() => setDesktopColumns(2)}
                    style={[
                      styles.desktopColumnSelectorButton,
                      desktopColumns === 2 && styles.desktopColumnSelectorButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.desktopColumnSelectorText,
                        desktopColumns === 2 && styles.desktopColumnSelectorTextActive,
                      ]}
                    >
                      2 col
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <IconButton
                name={expanded ? "remove-outline" : "expand-outline"}
                label={tr(
                  expanded ? "Minimizar reproductor" : "Ampliar reproductor",
                )}
                onPress={() => setExpanded((value) => !value)}
              />
              <IconButton
                name="close-outline"
                label={tr("Detener y cerrar reproductor")}
                onPress={stop}
              />
            </View>
            {!expanded ? (
              <View pointerEvents="none" style={styles.playerEngineHidden}>
                <YouTubeSurface key={session.requestId} {...playerSurfaceProps} />
              </View>
            ) : null}
            <View
              onLayout={logLayout("expandedBody")}
              style={[
                styles.body,
                expanded && styles.expandedBody,
                !mediaLayout && styles.mobileBody,
                desktop && styles.desktopBody,
                tablet && styles.tabletBody,
                tabletPortrait && styles.tabletBodyPortrait,
                tabletLandscape && styles.tabletBodyLandscape,
                tabletOneColumn && styles.tabletBodyOneColumn,
                oneColumnDesktop && styles.desktopBodyOneColumn,
                twoColumnDesktop && styles.desktopBodyTwoColumns,
              ]}
            >
              {expanded ? (
                <>
                  {mediaLayout ? (
                    <View
                      style={[
                        styles.desktopVideoPane,
                        tablet && styles.tabletVideoPane,
                        tabletPortrait && styles.tabletVideoPanePortrait,
                        tabletLandscape && styles.tabletVideoPaneLandscape,
                        oneColumnDesktop && styles.desktopVideoPaneOneColumn,
                        twoColumnDesktop && styles.desktopVideoPaneTwoColumns,
                      ]}
                    >
                      <View
                        style={[
                          styles.desktopVideoFrame,
                          tablet && styles.tabletVideoFrame,
                          oneColumnLayout && { width: oneColumnVideoWidth },
                          tabletPortrait && {
                            maxWidth: Math.min(720, Math.max(360, (height * 0.55 * 16) / 9)),
                          },
                          // En vertical, limitar el vídeo al 27,5 % del alto
                          // útil aproximado; el espacio restante corresponde
                          // a la playlist, que conserva su propio scroll.
                          ipadPortrait && {
                            width: ipadPortraitVideoWidth,
                            maxWidth: ipadPortraitVideoWidth,
                          },
                        ]}
                      >
                        <YouTubeSurface
                          key={`desktop:${session.requestId}`}
                          {...playerSurfaceProps}
                        />
                      </View>
                      <LyricsBelowVideo
                        key={`lyrics-media:${session.requestId}`}
                        track={track}
                        uri={lyricsUri}
                        time={status.time || 0}
                        containerStyle={[
                          oneColumnLayout && { alignSelf: "center", width: oneColumnVideoWidth, maxWidth: oneColumnVideoWidth },
                          ipadPortrait && { alignSelf: "center", width: ipadPortraitVideoWidth, maxWidth: ipadPortraitVideoWidth },
                        ]}
                      />
                    </View>
                  ) : null}
                  {!mediaLayout ? (
                    <View style={styles.mobileVideoSection}>
                      <View style={styles.mobileVideoFrame}>
                        <YouTubeSurface
                          key={`mobile:${session.requestId}`}
                          {...playerSurfaceProps}
                        />
                      </View>
                      <LyricsBelowVideo
                        key={`lyrics-mobile:${session.requestId}`}
                        track={track}
                        uri={lyricsUri}
                        time={status.time || 0}
                      />
                    </View>
                  ) : null}
                <TrackPaneComponent
                  onLayout={logLayout("trackPane")}
                  style={[
                    styles.trackPane,
                    !mediaLayout && styles.mobileTrackPane,
                    tablet && styles.tabletTrackPane,
                    tabletPortrait && styles.tabletTrackPanePortrait,
                    tabletLandscape && styles.tabletTrackPaneLandscape,
                    tabletOneColumn && styles.tabletTrackPaneOneColumn,
                    tabletOneColumn && { width: oneColumnVideoWidth, maxWidth: oneColumnVideoWidth },
                    desktop && styles.desktopTrackPane,
                    oneColumnDesktop && styles.desktopTrackPaneOneColumn,
                    oneColumnDesktop && { width: oneColumnVideoWidth, maxWidth: oneColumnVideoWidth },
                    twoColumnDesktop && styles.desktopTrackPaneTwoColumns,
                    // En 2 columnas el propio View es también el content container.
                    twoColumnDesktop && styles.trackList,
                    twoColumnDesktop && styles.desktopTrackList,
                    twoColumnDesktop && styles.desktopTrackListTwoColumns,
                    twoColumnDesktop && styles.desktopTrackPaneNativeScroll,
                    // En una columna no desplazamos el panel exterior.
                    // Solo la lista interior recibe los gestos de scroll.
                    fixedVideoColumn && styles.fixedVideoQueuePane,
                    fixedVideoColumn && styles.trackList,
                    tablet && fixedVideoColumn && styles.tabletTrackList,
                    desktop && fixedVideoColumn && styles.desktopTrackList,
                    fixedVideoColumn && styles.fixedVideoQueuePaneSpacing,
                  ]}
                  {...(!(twoColumnDesktop || fixedVideoColumn)
                    ? {
                        contentContainerStyle: [
                          styles.trackList,
                          tablet && styles.tabletTrackList,
                          desktop && styles.desktopTrackList,
                          oneColumnDesktop && styles.desktopTrackListOneColumn,
                        ],
                        scrollEnabled: true,
                        showsVerticalScrollIndicator: false,
                        alwaysBounceVertical: true,
                        bounces: true,
                        nestedScrollEnabled: true,
                        directionalLockEnabled: true,
                        canCancelContentTouches: true,
                        overScrollMode: "always",
                        decelerationRate: "normal",
                        keyboardShouldPersistTaps: "handled",
                        keyboardDismissMode: "on-drag",
                        scrollEventThrottle: 16,
                      }
                    : {})}
                >
                  {status.error ? (
                    <View style={styles.message}>
                      <Text style={styles.error}>{status.error}</Text>
                      <View style={styles.errorActions}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => installSession(session)}
                        >
                          <Text style={styles.retry}>Reintentar</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={openExternal}
                        >
                          <Text style={styles.retry}>Abrir en YouTube</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : status.notice ? (
                    <Text style={styles.notice}>{status.notice}</Text>
                  ) : null}
                  {session.tracks.map((item, index) => {
                    const active = index === session.index;
                    if (!active) return null;
                    const itemPlaying = active && playing;
                    const remembered = rememberedPlayback.current.get(
                      trackKey(item),
                    );
                    const elapsed = active
                      ? status.time
                      : remembered?.time || 0;
                    const duration = active
                      ? status.duration
                      : remembered?.duration || 0;
                    const imageId =
                      active && status.videoId ? status.videoId : item.videoId;
                    const cardTitle = active
                      ? currentTitle || item.title
                      : item.title;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.track,
                          styles.legacyCurrentTrack,
                          !wideTransport && styles.trackMobile,
                        ]}
                      >
                        <Pressable
                          onPress={() => select(index)}
                          accessibilityRole="button"
                          accessibilityLabel={tr(
                            itemPlaying
                              ? `Pausar ${item.title}`
                              : `Reproducir ${item.title}`,
                          )}
                          accessibilityState={{ selected: active }}
                          style={[
                            styles.cardArtworkButton,
                            !wideTransport && styles.cardArtworkButtonMobile,
                          ]}
                        >
                          {(item.artworkUrl || imageId) ? (
                            <Image
                              source={{
                                uri: /^https:\/\/[^\s]+$/i.test(item.artworkUrl || "")
                                  ? item.artworkUrl
                                  : `https://i.ytimg.com/vi/${imageId}/mqdefault.jpg`,
                              }}
                              style={[
                                styles.cardArtwork,
                                !wideTransport && styles.cardArtworkMobile,
                              ]}
                            />
                          ) : (
                            <View
                              style={[
                                styles.cardArtwork,
                                !wideTransport && styles.cardArtworkMobile,
                                styles.fallback,
                              ]}
                            >
                              <Ionicons
                                name="albums-outline"
                                size={34}
                                color="#dc2626"
                              />
                            </View>
                          )}
                        </Pressable>

                        <View
                          style={[
                            styles.cardRight,
                            !wideTransport && styles.cardRightMobile,
                          ]}
                        >
                          <View
                            style={[
                              styles.cardUpperHalf,
                              PLAYBACK_CARD_LAYOUT === "balanced"
                                ? styles.cardUpperBalanced
                                : styles.cardUpperVolumeInControls,
                              !wideTransport && styles.cardUpperHalfMobile,
                            ]}
                          >
                            <View style={styles.cardTextBlock}>
                              <Text
                                style={[
                                  styles.cardHeadingTitle,
                                  !wideTransport &&
                                    styles.cardHeadingTitleMobile,
                                ]}
                                numberOfLines={1}
                              >
                                {cardTitle}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.cardTimes,
                                !wideTransport && styles.cardTimesMobile,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.cardCurrentTime,
                                  !wideTransport &&
                                    styles.cardCurrentTimeMobile,
                                ]}
                              >
                                {formatTime(elapsed)}
                              </Text>
                              <Text
                                style={[
                                  styles.cardTotalTime,
                                  !wideTransport && styles.cardTotalTimeMobile,
                                ]}
                              >
                                {duration ? formatTime(duration) : "—:—"}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.cardProgressRow,
                              !wideTransport && styles.cardProgressRowMobile,
                            ]}
                          >
                            <Slider
                              style={styles.cardProgressSlider}
                              minimumValue={0}
                              maximumValue={Math.max(duration || 0, 1)}
                              value={Math.min(
                                elapsed || 0,
                                Math.max(duration || 0, 1),
                              )}
                              disabled={!active || !status.ready || !duration}
                              onSlidingComplete={(value) =>
                                player.current?.seek(value)
                              }
                              minimumTrackTintColor="#ec1970"
                              maximumTrackTintColor="transparent"
                              thumbTintColor="transparent"
                            />
                          </View>

                          <View
                            style={[
                              styles.cardLowerHalf,
                              PLAYBACK_CARD_LAYOUT === "balanced"
                                ? styles.cardLowerBalanced
                                : styles.cardLowerVolumeInControls,
                              !wideTransport && styles.cardLowerHalfMobile,
                            ]}
                          >
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Repetir canción"
                              onPress={() => setRepeat((value) => !value)}
                              style={[
                                styles.playerOptionButton,
                                styles.sectionThreeButton,
                              ]}
                            >
                              <Ionicons
                                name="repeat"
                                size={22}
                                color={repeat ? "#ec1970" : "#9aa0a6"}
                              />
                            </Pressable>
                            <View style={styles.playbackButtons}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Canción anterior"
                                onPress={() => selectRelative(-1)}
                                style={[
                                  styles.trackNavButton,
                                  styles.sectionThreeButton,
                                ]}
                              >
                                <Ionicons
                                  name="play-skip-back"
                                  size={25}
                                  color="#202124"
                                />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={tr(
                                  itemPlaying
                                    ? `Pausar ${item.title}`
                                    : `Reproducir ${item.title}`,
                                )}
                                disabled={
                                  active &&
                                  (!status.ready || Boolean(status.error))
                                }
                                onPress={() => select(index)}
                                style={[
                                  styles.transportPlayButton,
                                  styles.sectionThreeButton,
                                  !wideTransport &&
                                    styles.transportPlayButtonMobile,
                                  itemPlaying && styles.transportPauseButton,
                                ]}
                              >
                                <Ionicons
                                  name={itemPlaying ? "pause" : "play"}
                                  size={wideTransport ? 28 : 19}
                                  color="#202124"
                                />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Detener canción"
                                disabled={!active || !status.ready}
                                onPress={stopCurrentTrack}
                                style={({ pressed }) => [
                                  styles.trackStopButton,
                                  styles.sectionThreeButton,
                                  !wideTransport &&
                                    styles.trackStopButtonMobile,
                                  pressed && styles.trackStopButtonPressed,
                                  (!active || !status.ready) &&
                                    styles.trackStopButtonDisabled,
                                ]}
                              >
                                <Ionicons
                                  name="stop"
                                  size={wideTransport ? 24 : 19}
                                  color="#202124"
                                />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Canción siguiente"
                                onPress={() => selectRelative(1)}
                                style={[
                                  styles.trackNavButton,
                                  styles.sectionThreeButton,
                                ]}
                              >
                                <Ionicons
                                  name="play-skip-forward"
                                  size={25}
                                  color="#202124"
                                />
                              </Pressable>
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Orden aleatorio"
                              onPress={() => setShuffle((value) => !value)}
                              style={[
                                styles.playerOptionButton,
                                styles.sectionThreeButton,
                              ]}
                            >
                              <Ionicons
                                name="shuffle"
                                size={22}
                                color={shuffle ? "#ec1970" : "#9aa0a6"}
                              />
                            </Pressable>
                            <Pressable
                              accessibilityRole="link"
                              accessibilityLabel={tr(
                                `Abrir ${cardTitle} en YouTube`,
                              )}
                              onPress={() => openTrackExternal(item, active)}
                              style={[
                                styles.youtubeButton,
                                styles.youtubeButtonLower,
                                styles.sectionThreeButton,
                                !wideTransport && styles.youtubeButtonMobile,
                              ]}
                            >
                              <Ionicons
                                name="logo-youtube"
                                size={wideTransport ? 30 : 22}
                                color="#ff0000"
                              />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  <View
                    onLayout={logLayout("queueSection")}
                    style={[
                      styles.queueSection,
                      twoColumnDesktop && styles.queueSectionTwoColumns,
                      fixedVideoColumn && styles.queueSectionTabletOneColumn,
                    ]}
                  >
                    <QueueRowsComponent
                      onLayout={logLayout("queueRowsScroll")}
                      style={[
                        styles.queueRowsScroll,
                        !queueHasOwnScroll && styles.queueRows,
                        // El layout de laptop/Chrome necesita aprovechar
                        // TODO el alto restante; el maxHeight heredado de
                        // tabletPortrait limitaba la lista a ~260 px.
                        // La altura depende del flex restante del panel;
                        // el maxHeight anterior cortaba la lista en iPad.
                        (twoColumnDesktop || tabletLandscape) && styles.queueRowsScrollTwoColumns,
                        oneColumnLayout && styles.queueRowsScrollOneColumn,
                        fixedVideoColumn && styles.queueRowsScrollTabletOneColumn,
                      ]}
                      {...(!queueHasOwnScroll
                        ? {}
                        : {
                            contentContainerStyle: styles.queueRows,
                            nestedScrollEnabled: true,
                            scrollEnabled: true,
                            showsVerticalScrollIndicator: false,
                            keyboardShouldPersistTaps: "handled",
                          })}
                    >
                      {session.tracks.map((item, index) => {
                        const active = index === session.index;
                        const itemTitle =
                          item.title ||
                          `${session.isTutorial ? "Vídeo" : "Elemento"} ${index + 1}`;
                        const kindLabel = session.isTutorial
                          ? item.kind === "album"
                            ? "Serie"
                            : "Vídeo"
                          : item.kind === "album"
                            ? "Álbum"
                            : "Single";
                        return (
                          <View
                            key={`${trackKey(item)}:${index}`}
                            style={styles.queueEntry}
                          >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={tr(
                              active
                                ? `${playing ? "Pausar" : "Reproducir"} ${itemTitle}`
                                : `Reproducir ${itemTitle}`,
                            )}
                            accessibilityState={{ selected: active }}
                            onPress={() => select(index)}
                            style={[styles.queueRow, active && styles.queueRowActive]}
                          >
                            <View
                              style={[
                                styles.queueRowIndex,
                                active && styles.queueRowIndexActive,
                              ]}
                            >
                              {active ? (
                                <Ionicons
                                  name={playing ? "pause" : "musical-note"}
                                  size={15}
                                  color="#ec1970"
                                />
                              ) : (
                                <Text style={styles.queueRowIndexText}>{index + 1}</Text>
                              )}
                            </View>
                            <View style={styles.queueRowText}>
                              <View style={styles.queueRowTitleLine}>
                                <Text style={styles.queueRowTitle} numberOfLines={1}>
                                  {itemTitle}
                                </Text>
                                <LyricsAvailabilityMark track={item} />
                              </View>
                              <Text style={styles.queueRowMeta}>
                                {active
                                  ? playing
                                    ? "Reproduciendo"
                                    : "Seleccionada"
                                  : kindLabel}
                              </Text>
                            </View>
                            <Ionicons
                              name={active && playing ? "pause-circle" : "play-circle-outline"}
                              size={24}
                              color={active ? "#ec1970" : "#9ca3af"}
                            />
                          </Pressable>
                          </View>
                        );
                      })}
                      {fixedVideoColumn ? albumVideoRows : null}
                    </QueueRowsComponent>
                  </View>
                  {!fixedVideoColumn ? albumVideoRows : null}
                </TrackPaneComponent>
                </>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </PlaybackContext.Provider>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  player: {
    position: "absolute",
    backgroundColor: "#0b0b0c",
    zIndex: 1000,
    elevation: 30,
    borderWidth: 1,
    borderColor: "#29292d",
  },
  // Contiene los hijos dentro del modal: evita que el contenido del
  // ScrollView aparezca por debajo de su borde en Chrome.
  expanded: { top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" },
  mini: {
    right: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#29292d",
    backgroundColor: "#111113",
  },
  heading: { flex: 1, minWidth: 0, paddingLeft: 16 },
  headerPlaybackOptions: { flexDirection: "row", alignItems: "center", gap: 5, marginRight: 8 },
  headerPlaybackOption: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 38, minWidth: 46, paddingHorizontal: 8, gap: 3, borderWidth: 1, borderRadius: 6, borderColor: "#3f3f46", backgroundColor: "#18181b" },
  headerPlaybackOptionsMobile: { gap: 4, marginRight: 2 },
  headerPlaybackOptionMobile: { minWidth: 44, minHeight: 44, paddingHorizontal: 5 },
  headerPlaybackOptionActive: { borderColor: "#ec1970", backgroundColor: "#411629" },
  headerPlaybackOptionText: { fontSize: 11, color: "#d4d4d8", fontWeight: "700" },
  headerPlaybackOptionTextActive: { color: "#f9a8d4" },

  headerPlaylistTitle: {
    minHeight: 42,
    justifyContent: "center",
  },
  headerPlaylistEyebrow: {
    marginBottom: 1,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 1.15,
    fontWeight: "900",
    color: "#ef4444",
  },
  title: { fontSize: 14, fontWeight: "800", color: "#f9fafb" },
  // Antes faltaban estos estilos: los controles de tamaño se apilaban
  // verticalmente sin contraste y separaban el vídeo de la lista.
  videoSizeSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 30,
    paddingVertical: 2,
    marginBottom: 3,
  },
  videoSizeSelectorLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#a1a1aa",
  },
  videoSizeSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  videoSizeSelectorButton: {
    paddingHorizontal: 10,
    height: 27,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 5,
    backgroundColor: "#18181b",
  },
  videoSizeSelectorButtonActive: {
    borderColor: "#ec1970",
    backgroundColor: "#591632",
  },
  videoSizeSelectorText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#d4d4d8",
  },
  videoSizeSelectorTextActive: {
    color: "#ffffff",
  },
  desktopColumnSelector: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#111113",
  },
  desktopColumnSelectorButton: {
    minWidth: 58,
    height: 34,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  desktopColumnSelectorButtonActive: {
    backgroundColor: "#ec1970",
  },
  desktopColumnSelectorText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#d4d4d8",
  },
  desktopColumnSelectorTextActive: { color: "#fff" },
  iconButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.35 },
  body: { minHeight: 0, flexShrink: 1 },
  expandedBody: { flex: 1, backgroundColor: "#0b0b0c" },
  // Móvil: la superficie YouTube se mantiene fuera del área desplazable.
  // Solo mobileTrackPane contiene el ScrollView de las pistas.
  mobileBody: {
    flexDirection: "column",
    overflow: "hidden",
    minHeight: 0,
  },
  mobileTrackPane: {
    flex: 1,
    minHeight: 0,
    alignSelf: "stretch",
  },
  tabletBody: {
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 14,
  },
  tabletBodyPortrait: {
    flexDirection: "column",
    alignItems: "center",
    minHeight: 0,
    overflow: "hidden",
    gap: 8,
  },
  tabletBodyOneColumn: {
    minHeight: 0,
    overflow: "hidden",
  },
  tabletBodyLandscape: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  tabletVideoPane: {
    minWidth: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 12,
  },
  tabletVideoPanePortrait: {
    width: "100%",
    maxWidth: 720,
    flexShrink: 0,
  },
  tabletVideoPaneLandscape: {
    flex: 1.05,
    width: "51%",
    maxWidth: "51%",
  },
  tabletVideoFrame: {
    width: "100%",
    maxWidth: 720,
  },
  tabletTrackPane: {
    minWidth: 0,
    alignSelf: "stretch",
  },
  tabletTrackPanePortrait: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  tabletTrackPaneOneColumn: {
    flex: 1,
    minHeight: 0,
    alignSelf: "center",
    overflow: "hidden",
    ...Platform.select({ web: { overflowY: "hidden", overflowX: "hidden" } }),
  },
  fixedVideoQueuePane: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    ...Platform.select({ web: { overflowY: "hidden", overflowX: "hidden" } }),
  },
  fixedVideoQueuePaneSpacing: {
    paddingTop: 4,
    paddingBottom: 4,
    gap: 4,
  },
  tabletTrackPaneLandscape: {
    flex: 1,
    width: "49%",
    maxWidth: "49%",
  },
  tabletTrackList: {
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 9,
  },
  desktopBody: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    paddingHorizontal: 24,
    gap: 20,
  },
  desktopBodyOneColumn: {
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  desktopBodyTwoColumns: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  desktopVideoPane: {
    minWidth: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 18,
  },
  desktopVideoPaneOneColumn: {
    width: "100%",
    maxWidth: 900,
    flexShrink: 0,
    paddingTop: 8,
  },
  desktopVideoPaneTwoColumns: {
    flex: 1,
    width: "56%",
    maxWidth: "56%",
  },
  desktopVideoFrame: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#29292d",
    borderRadius: 8,
  },
  desktopTrackPane: {
    minWidth: 0,
    alignSelf: "stretch",
  },
  desktopTrackPaneOneColumn: {
    flex: 1,
    alignSelf: "center",
    marginTop: 0,
  },
  desktopTrackPaneTwoColumns: {
    flex: 1,
    flexBasis: 0,
    width: "44%",
    maxWidth: "44%",
    minWidth: 400,
    minHeight: 0,
    alignSelf: "stretch",
    overflow: "hidden",
  },
  lyricStripBelowVideo: {
    alignSelf: "stretch",
    width: "100%",
    marginTop: 8,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: "center",
    backgroundColor: "#17171b",
    borderWidth: 1,
    borderColor: "#29292d",
    borderRadius: 5,
  },
  lyricTextBelowVideo: {
    color: "#facc15",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
  desktopLyricsPanel: {
    flex: 1,
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#29292d",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  desktopLyricsHeader: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
  },
  desktopLyricsEyebrow: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "900",
    color: "#ef4444",
  },
  desktopLyricsTitle: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    color: "#f9fafb",
  },
  desktopLyricsScroll: {
    flex: 1,
    minHeight: 0,
    ...Platform.select({
      web: { scrollbarWidth: "none", msOverflowStyle: "none" },
    }),
  },
  desktopLyricsContent: {
    paddingTop: 24,
    paddingRight: 20,
    paddingBottom: 240,
    gap: 16,
  },
  desktopLyricLine: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "650",
    color: "#71717a",
  },
  desktopLyricLineActive: {
    fontSize: 22,
    lineHeight: 31,
    fontWeight: "900",
    color: "#f9fafb",
  },
  desktopLyricsEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 30,
  },
  desktopLyricsEmptyTitle: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "800",
    color: "#d4d4d8",
    textAlign: "center",
  },
  desktopLyricsEmptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#71717a",
    textAlign: "center",
  },
  playerEngineHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    left: -2,
    top: 52,
    opacity: 0.001,
  },
  media: { flexGrow: 0, flexShrink: 1, width: "100%", minWidth: 0 },
  mediaContent: { alignItems: "center", paddingBottom: 14 },
  desktopMedia: {
    flexGrow: 1.6,
    flexShrink: 1,
    flexBasis: 0,
    width: "auto",
    minWidth: 0,
  },
  mediaEyebrowRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 9,
  },
  mediaEyebrow: {
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: "900",
    color: "#ef4444",
  },
  mediaSource: { fontSize: 11, fontWeight: "700", color: "#9ca3af" },
  videoFrame: { overflow: "hidden", backgroundColor: "#000", borderRadius: 8 },
  controls: {
    width: "100%",
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
  },
  controlText: { flex: 1, minWidth: 0, paddingHorizontal: 3 },
  nowPlaying: { fontSize: 16, fontWeight: "800", color: "#f9fafb" },
  collectionTitle: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  time: {
    fontSize: 11,
    color: "#d1d5db",
    marginTop: 5,
    fontVariant: ["tabular-nums"],
  },
  slider: { width: "100%", height: 28 },
  trackPane: {
    flex: 1,
    minHeight: 0,
    backgroundColor: "#0b0b0c",
    ...Platform.select({
      web: {
        touchAction: "pan-y",
        overscrollBehaviorY: "contain",
        WebkitOverflowScrolling: "touch",
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      },
    }),
  },
  trackList: {
    width: "100%",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 30,
    ...Platform.select({ web: { touchAction: "pan-y" } }),
  },
  desktopTrackList: {
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 0,
    paddingTop: 18,
    gap: 10,
  },
  desktopTrackListOneColumn: { maxWidth: 900, paddingTop: 2, gap: 6 },
  desktopTrackListTwoColumns: {
    maxWidth: "100%",
    minHeight: 0,
    paddingTop: 10,
    paddingBottom: 10,
  },
  desktopTrackPaneNativeScroll: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    ...Platform.select({
      web: {
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
      },
    }),
  },
  mobileVideoSection: {
    width: "100%",
    flexShrink: 0,
    alignSelf: "stretch",
  },
  mobileVideoFrame: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  queueSection: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    marginTop: 0,
    paddingTop: 0,
  },
  queueSectionTwoColumns: {
    width: "100%",
    maxWidth: "100%",
    minHeight: 0,
  },
  queueSectionTabletOneColumn: {
    flex: 1,
    minHeight: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },
  queueSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  queueSectionEyebrow: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "900",
    color: "#ef4444",
  },
  queueSectionCount: { fontSize: 11, color: "#9ca3af" },
  queueRowsScroll: {
    ...Platform.select({
      web: {
        touchAction: "pan-y",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      },
    }),
  },
  queueRowsScrollOneColumn: {
    width: "100%",
  },
  queueRowsScrollTabletOneColumn: {
    flex: 1,
    minHeight: 0,
    ...Platform.select({ web: {
      overflowY: "auto",
      overflowX: "hidden",
      overscrollBehaviorY: "contain",
      WebkitOverflowScrolling: "touch",
    } }),
  },
  queueRowsScrollTwoColumns: {
    width: "100%",
    minHeight: 0,
    gap: 6,
  },
  queueRows: { gap: 6 },
  queueEntry: { width: "100%" },
  queueRow: {
    minHeight: 64,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#29292d",
    backgroundColor: "#151518",
    ...Platform.select({ web: { touchAction: "pan-y" } }),
  },
  queueRowActive: {
    borderColor: "#ec1970",
    backgroundColor: "#24131d",
  },
  queuePreview: {
    marginTop: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#ec1970",
    backgroundColor: "#110d10",
  },
  queuePreviewFrame: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: "#000",
  },
  queuePreviewHint: {
    marginTop: 7,
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
  },
  queueRowIndex: {
    width: 22,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  queueRowIndexActive: { backgroundColor: "#331323" },
  queueRowIndexText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9ca3af",
    fontVariant: ["tabular-nums"],
  },
  queueRowText: { flex: 1, minWidth: 0 },
  // La marca LRC comparte fila con el título; evita aumentar la tarjeta.
  queueRowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  lyricsMark: {
    width: 14,
    height: 14,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  queueLyricsBox: {
    marginTop: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#facc15",
    backgroundColor: "#301c2a",
  },
  queueLyricsCurrent: {
    color: "#facc15",
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
    fontWeight: "600",
  },
  queueLyricsNext: {
    color: "#d1d5db",
    fontSize: 13,
    lineHeight: 19,
  },
  queueLyricsStatus: {
    color: "#d1d5db",
    fontSize: 12,
    lineHeight: 18,
  },
  queueThumbnail: {
    width: 76,
    height: 43,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: "#27272a",
  },
  queueThumbnailImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#27272a",
  },
  queueThumbnailFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#334155",
  },
  queueRowTitle: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  queueRowMeta: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    color: "#9ca3af",
  },
  track: {
    width: "100%",
    maxWidth: 900,
    aspectRatio: 2.68,
    alignSelf: "center",
    flexDirection: "row",
    padding: 0,
    gap: 0,
    borderWidth: 1,
    borderColor: "#d7d9dc",
    borderRadius: 0,
    backgroundColor: "#fff",
    overflow: "hidden",
    ...Platform.select({ web: { touchAction: "pan-y" } }),
  },
  legacyCurrentTrack: { display: "none" },
  cardArtworkButton: { height: "100%", aspectRatio: 1, flexShrink: 0 },
  cardArtwork: { width: "100%", height: "100%", backgroundColor: "#27272a" },
  cardRight: { flex: 1, minWidth: 0, height: "100%", backgroundColor: "#fff" },
  cardUpperHalf: {
    flex: 1,
    flexBasis: 0,
    minHeight: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 18,
    paddingLeft: 24,
    paddingRight: 14,
    backgroundColor: "#f7f7f7",
  },
  cardUpperBalanced: { flex: 3 },
  cardUpperVolumeInControls: { flex: 3 },
  cardTextBlock: { flex: 1, minWidth: 0, justifyContent: "flex-start" },
  cardTimes: {
    width: 92,
    flexShrink: 0,
    alignItems: "flex-end",
    paddingTop: 1,
  },
  cardCurrentTime: {
    fontFamily: CARD_FONT,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: "400",
    color: "#65696e",
    fontVariant: ["tabular-nums"],
  },
  cardTotalTime: {
    fontFamily: CARD_FONT,
    marginTop: 1,
    fontSize: 16,
    lineHeight: 19,
    fontWeight: "500",
    color: "#85898f",
    fontVariant: ["tabular-nums"],
  },
  cardProgressRow: {
    height: 6,
    justifyContent: "center",
    backgroundColor: "#dff3ff",
    margin: 0,
    padding: 0,
  },
  cardProgressRowMobile: { height: 5 },
  cardProgressSlider: {
    width: "100%",
    height: 6,
    margin: 0,
    padding: 0,
    ...Platform.select({ web: { touchAction: "pan-x" } }),
  },
  cardLowerHalf: {
    flex: 1,
    flexBasis: 0,
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 5,
    backgroundColor: "#fff",
  },
  cardLowerBalanced: { flex: 2 },
  cardLowerVolumeInControls: {
    flex: 2,
    gap: 1,
    paddingHorizontal: 4,
  },
  playerOptionButton: {
    width: 30,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionThreeButton: Platform.select({
    web: { outlineStyle: "none" },
    default: {},
  }),
  trackMobile: { height: 140 },
  cardArtworkButtonMobile: { width: 140, height: 140 },
  cardArtworkMobile: { width: 140, height: 140 },
  cardRightMobile: { height: 140 },
  cardUpperHalfMobile: { paddingTop: 8, paddingLeft: 10, paddingRight: 5 },
  cardHeadingTitleMobile: { marginRight: 4, fontSize: 14, lineHeight: 17 },
  cardTimesMobile: { width: 56 },
  cardCurrentTimeMobile: { fontSize: 24, lineHeight: 26, fontWeight: "400" },
  cardTotalTimeMobile: { fontSize: 12, lineHeight: 14 },
  youtubeButtonMobile: { width: 28, height: 34, marginLeft: 0 },
  cardLowerHalfMobile: {
    minHeight: 50,
    paddingHorizontal: 7,
    paddingTop: 8,
    paddingBottom: 2,
    gap: 4,
  },
  mobileCardHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  desktopCardHeader: { height: 112, alignItems: "flex-start", padding: 0 },
  mobileArtworkButton: { width: 82, height: 82, flexShrink: 0 },
  mobileThumbnail: {
    width: 82,
    height: 82,
    borderRadius: 7,
    backgroundColor: "#27272a",
  },
  mobileHeadingContent: { flex: 1, minWidth: 0, justifyContent: "center" },
  cardTop: { width: "100%", gap: 10 },
  desktopCardTop: { flexDirection: "row", alignItems: "center" },
  trackMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    ...Platform.select({ web: { touchAction: "pan-y" } }),
  },
  activeTrackMain: { flex: 0, width: 118 },
  wideTrackMain: { width: 112, height: 112 },
  trackControls: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 2,
  },
  desktopTrackControls: { width: "auto", flexShrink: 0, paddingTop: 0 },
  trackPlayButton: {
    width: 44,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#52525b",
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  activePlayButton: { borderColor: "#ef4444", backgroundColor: "#ef4444" },
  activeTransport: {
    width: "100%",
    minHeight: 0,
    gap: 7,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
    borderRadius: 0,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  sideTransport: {
    position: "absolute",
    width: "auto",
    left: 112,
    right: 0,
    top: 40,
    height: 72,
    minHeight: 0,
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 5,
    justifyContent: "center",
  },
  transportTop: { width: "100%", gap: 6, paddingTop: 2 },
  wideTransport: { flexDirection: "row", alignItems: "center", gap: 8 },
  playbackButtons: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    flexShrink: 0,
  },
  trackStopButton: {
    width: 40,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  trackStopButtonMobile: { width: 32, height: 36 },
  trackStopButtonPressed: { opacity: 0.55 },
  trackStopButtonDisabled: { opacity: 0.25 },
  trackNavButton: {
    width: 34,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({ web: { touchAction: "pan-y" } }),
  },
  transportPlayButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#202124",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    ...Platform.select({ web: { touchAction: "pan-y" } }),
  },
  transportPlayButtonMobile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  inactiveTransportPlayButton: { backgroundColor: "#fff" },
  transportPauseButton: { backgroundColor: "#fff", borderColor: "#202124" },
  cardHeadingRow: {
    width: "100%",
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardHeadingTitle: {
    minWidth: 0,
    marginRight: 12,
    fontFamily: CARD_FONT,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "600",
    color: "#202124",
  },
  youtubeButton: {
    width: 46,
    height: 38,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    ...Platform.select({ web: { touchAction: "pan-y" } }),
  },
  youtubeButtonLower: { marginLeft: 2 },
  timelineBlock: { flex: 1, minWidth: 180, gap: 1 },
  timeLabels: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  transportTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: "700",
    color: "#73777d",
    textAlign: "center",
  },
  progressTime: {
    width: 43,
    fontSize: 12,
    fontWeight: "800",
    color: "#5f6368",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  albumVideoRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  activeTrack: { borderColor: "#ec1970", backgroundColor: "#fff" },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: 5,
    backgroundColor: "#27272a",
  },
  activeThumbnail: { width: 118, height: 118 },
  wideThumbnail: { width: 112, height: 112, borderRadius: 0 },
  fallback: { alignItems: "center", justifyContent: "center" },
  trackText: { flex: 1, minWidth: 0 },
  trackTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  trackTime: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: "700",
    color: "#d1d5db",
    fontVariant: ["tabular-nums"],
  },
  meta: { fontSize: 10, color: "#9ca3af", marginVertical: 3 },
  albumVideos: { gap: 7, paddingTop: 10 },
  cardLyric: {
    minWidth: 0,
    minHeight: 28,
    paddingTop: 3,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "transparent",
  },
  cardLyricSpacer: { width: "100%", height: 38, marginTop: 4 },
  cardLyricText: {
    flex: 1,
    minWidth: 0,
    fontFamily: CARD_FONT,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400",
    color: "#6f7378",
    textAlign: "left",
  },
  cardLyricTextMobile: { fontSize: 12, lineHeight: 15 },
  message: { width: "100%", padding: 10, gap: 8 },
  errorActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  error: { color: "#b91c1c", fontSize: 12 },
  retry: { color: "#2563eb", fontWeight: "700", paddingVertical: 5 },
  notice: { fontSize: 12, color: "#9ca3af", padding: 8 },
});
