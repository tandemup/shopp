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

function SyncedLyricLine({ track, uri, time, compact = false, fallback = null }) {
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
  }, [track?.videoId, track?.playlistId, track?.url, uri]);
  if (!lines.length) return fallback ? <Text style={styles.phoneLyricEmpty}>{fallback}</Text> : null;
  let index = -1;
  lines.forEach((line, i) => {
    if (line.time <= time + 0.08) index = i;
  });
  const text = lines[index]?.text || lines[0]?.text;
  if (!text) return fallback ? <Text style={styles.phoneLyricEmpty}>{fallback}</Text> : null;
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

function DesktopLyricsPanel({ track, uri, time, title }) {
  const [lines, setLines] = useState([]);
  const [hasSource, setHasSource] = useState(Boolean(uri));
  const scrollRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setLines([]);
    setHasSource(Boolean(uri));
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track?.videoId, track?.playlistId, track?.url, uri]);
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
      {!hasSource ? (
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
          <Text style={styles.desktopLyricsEmptyText}>Cargando letra…</Text>
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
  const [playerStyle, setPlayerStyle] = useState("integrated");
  const [mobilePlayerStyle, setMobilePlayerStyle] = useState("classic");
  const [phoneCardWidth, setPhoneCardWidth] = useState(0);
  const [integratedSize, setIntegratedSize] = useState("medium");
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [volume, setVolume] = useState(100);
  const trackVolumes = useRef(new Map());
  const [status, setStatus] = useState(EMPTY_STATUS);
  const statusRef = useRef(EMPTY_STATUS);
  const player = useRef(null);
  const serial = useRef(0);
  const autoPlayAttempt = useRef(null);
  const advancingTrack = useRef(false);
  const rememberedPlayback = useRef(new Map());
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
    (playlist, { isTutorial = false, autoPlay = false } = {}) => {
      const tracks = (playlist?.tracks || [])
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
          resumeTime: remembered?.time || 0,
          resumePlaylistIndex: remembered?.playlistIndex || 0,
          autoPlay: Boolean(autoPlay),
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
  const select = (index, restart = false) => {
    if (index === session.index) {
      playing ? player.current?.pause() : player.current?.play();
      return;
    }
    rememberCurrentPlayback();
    const remembered = rememberedPlayback.current.get(
      trackKey(session.tracks[index]),
    );
    setVolume(trackVolumes.current.get(trackKey(session.tracks[index])) ?? 100);
    const nextTrack = session.tracks[index];
    const nextTime = restart ? 0 : remembered?.time || 0;
    const nextPlaylistIndex = restart ? 0 : remembered?.playlistIndex || 0;
    if (statusRef.current.ready && player.current?.loadTrack) {
      advancingTrack.current = true;
      const nextSession = {
        ...session,
        index,
        resumeTime: nextTime,
        resumePlaylistIndex: nextPlaylistIndex,
        autoPlay: true,
      };
      sessionRef.current = nextSession;
      // La misma superficie de YouTube se conserva al cambiar de pista. No
      // marques el autoarranque como atendido: al recibir el primer estado de
      // la nueva carga el efecto de respaldo puede volver a pedir play.
      autoPlayAttempt.current = null;
      statusRef.current = EMPTY_STATUS;
      setStatus(EMPTY_STATUS);
      setSession(nextSession);
      player.current.loadTrack(nextTrack, nextTime, nextPlaylistIndex, true);
      return;
    }
    installSession({
      ...session,
      index,
      resumeTime: nextTime,
      resumePlaylistIndex: nextPlaylistIndex,
      autoPlay: true,
    });
  };
  const ids = status.videoIds || [];
  const albumIndex = status.playlistIndex || 0;
  // A partir de 700 px hay anchura suficiente para usar el reproductor
  // horizontal (vídeo + controles), también en iPad/tablets. No detectamos
  // el dispositivo: el layout responde únicamente al ancho disponible.
  const widePlayer = expanded && width >= 700;
  const desktop = expanded && width >= 1100;
  const phonePlayer = expanded && width < 600;
  // iPad/tablet: en estas pantallas prima que la lista de pistas sea visible
  // sin necesidad de desplazar primero un reproductor de gran altura. En web
  // usamos capacidad táctil para no aplicar este perfil a un portátil que tenga
  // una ventana con dimensiones similares a las de un iPad.
  const touchTablet =
    expanded &&
    Math.min(width, height) >= 700 &&
    Math.max(width, height) <= 1400 &&
    (Platform.OS !== "web" ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 1));
  const visiblePlayerStyle = phonePlayer ? mobilePlayerStyle : playerStyle;
  const phoneCard = phonePlayer && visiblePlayerStyle === "integrated";
  const phoneVideoHeight = Math.round((phoneCardWidth || Math.max(240, width - 24)) * 9 / 16);
  const phoneControlsHeight = 140;
  const integratedPreset = (touchTablet
    ? {
        // iPad: card más baja para dejar visibles varias pistas.
        small: { card: 900, video: 240 },
        medium: { card: 900, video: 280 },
        large: { card: 900, video: 320 },
      }
    : {
        // Desktop: la Card mantiene siempre el mismo ancho que la sección
        // de pistas. El selector solo cambia el ancho reservado al vídeo.
        small: { card: 900, video: 320 },
        medium: { card: 900, video: 400 },
        large: { card: 900, video: 480 },
      })[integratedSize];
  // En tablets estrechas reducimos el vídeo de forma proporcional para que
  // siempre quede una columna útil para título, tiempos y controles.
  const integratedCardWidth = Math.min(
    integratedPreset.card,
    Math.max(620, width - (widePlayer ? 48 : 28)),
  );
  const integratedVideoWidth = Math.min(
    integratedPreset.video,
    Math.max(280, Math.round(integratedCardWidth * 0.46)),
  );
  const integratedDimensions = {
    card: integratedCardWidth,
    video: integratedVideoWidth,
    height: Math.round((integratedVideoWidth * 9) / 16),
  };
  // El mismo selector de tamaño se usa también en el modo Clásico.
  // En ese modo controla el ancho del reproductor 16:9 completo.
  const classicPresetWidth = (touchTablet
    ? {
        // iPad: 16:9 compacto. Alturas aproximadas: 259 / 304 / 349 px.
        small: 460,
        medium: 540,
        large: 620,
      }
    : {
        small: 640,
        medium: 860,
        large: 1080,
      })[integratedSize];
  const classicVideoWidth = Math.min(
    classicPresetWidth,
    Math.max(320, width - (widePlayer ? 48 : 24)),
  );
  // El reproductor compartido conserva controles compactos y de tamaño fijo.
  // El ancho de la columna puede crecer con la ventana, pero las imágenes,
  // tipografías e iconos no deben saltar a una escala desproporcionada.
  const wideTransport = false;
  const miniWidth = Math.min(360, Math.max(200, width - 16));
  // En iPhone la lista comparte un único desplazamiento con el contenido.
  // En pantallas más anchas se conserva la altura máxima de la cola.
  const queueRowsMaxHeight = Math.max(
    widePlayer ? 320 : 220,
    height - insets.top - insets.bottom - (widePlayer ? 440 : 620),
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
  const selectRelative = (direction, restart = false) => {
    if (!session?.tracks?.length) return;
    if (shuffle && session.tracks.length > 1) {
      let next = session.index;
      while (next === session.index)
        next = Math.floor(Math.random() * session.tracks.length);
      select(next, restart);
      return;
    }
    select(
      (session.index + direction + session.tracks.length) %
        session.tracks.length,
      restart,
    );
  };
  useEffect(() => {
    if (!session || status.state !== 0 || advancingTrack.current) return;
    advancingTrack.current = true;
    if (repeat) {
      player.current?.seek(0);
      player.current?.play();
    } else if (session.tracks.length > 1) {
      selectRelative(1, true);
    } else {
      advancingTrack.current = false;
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
  const changePlayerStyle = (nextStyle) => {
    if (nextStyle === (phonePlayer ? mobilePlayerStyle : playerStyle)) return;
    const current = sessionRef.current;
    if (current) {
      const currentStatus = statusRef.current;
      const nextSession = {
        ...current,
        resumeTime: currentStatus.time || 0,
        resumePlaylistIndex: currentStatus.playlistIndex || 0,
        autoPlay: currentStatus.state === 1 || currentStatus.state === 3,
      };
      sessionRef.current = nextSession;
      setSession(nextSession);
    }
    if (phonePlayer) setMobilePlayerStyle(nextStyle);
    else setPlayerStyle(nextStyle);
  };
  const renderQueueRow = (item, index) => {
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
                          <Pressable
                            key={`${trackKey(item)}:${index}`}
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
                              <Text style={styles.queueRowTitle} numberOfLines={1}>
                                {itemTitle}
                              </Text>
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
                        );
  };

  const renderPlayerSurface = (containerStyle, interactive = true) => (
    <View
      pointerEvents={interactive ? "auto" : "none"}
      style={[styles.playerEngine, containerStyle]}
    >
      <YouTubeSurface
        key={session.requestId}
        ref={player}
        track={track}
        initialTime={session.resumeTime || 0}
        initialPlaylistIndex={session.resumePlaylistIndex || 0}
        autoPlay={Boolean(session.autoPlay)}
        initialVolume={volume}
        onStatus={(next) => {
          if (sessionRef.current?.requestId !== session.requestId) return;
          const mergedStatus = { ...statusRef.current, ...next };
          // El iframe/WebView puede emitir el último estado de la pista
          // anterior justo después de loadTrack(). Solo la nueva pista debe
          // dar por terminada la transición automática.
          const currentTrack = sessionRef.current.tracks[sessionRef.current.index];
          const isCurrentVideo =
            currentTrack?.kind === "album" ||
            !next.videoId ||
            next.videoId === currentTrack?.videoId;
          if (
            isCurrentVideo &&
            (mergedStatus.state === 1 || mergedStatus.state === 3)
          ) {
            advancingTrack.current = false;
          }
          statusRef.current = mergedStatus;
          if (Number.isFinite(next.time)) {
            rememberedPlayback.current.set(trackKey(currentTrack), {
              time: mergedStatus.state === 0 ? 0 : mergedStatus.time || 0,
              duration: mergedStatus.duration || 0,
              playlistIndex: mergedStatus.playlistIndex || 0,
            });
          }
          setStatus(mergedStatus);
        }}
      />
    </View>
  );
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
                <Text numberOfLines={1} style={styles.title}>
                  {expanded ? session.title : currentTitle || session.title}
                </Text>
              </Pressable>
              {expanded ? (
                <View style={styles.styleSelector}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: visiblePlayerStyle === "classic" }}
                    onPress={() => changePlayerStyle("classic")}
                    style={[
                      styles.styleSelectorButton,
                      visiblePlayerStyle === "classic" && styles.styleSelectorButtonActive,
                    ]}
                  >
                    <Text style={styles.styleSelectorText}>{phonePlayer ? "Vídeo" : "Clásico"}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: visiblePlayerStyle === "integrated" }}
                    onPress={() => changePlayerStyle("integrated")}
                    style={[
                      styles.styleSelectorButton,
                      visiblePlayerStyle === "integrated" && styles.styleSelectorButtonActive,
                    ]}
                  >
                    <Text style={styles.styleSelectorText}>{phonePlayer ? "Card" : "Integrado"}</Text>
                  </Pressable>
                </View>
              ) : null}
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
            {expanded && visiblePlayerStyle === "classic"
              ? renderPlayerSurface([
                  styles.playerEnginePreview,
                  widePlayer && { width: classicVideoWidth, maxWidth: classicVideoWidth },
                  touchTablet && styles.tabletPlayerEnginePreview,
                ])
              : !expanded
                ? renderPlayerSurface(styles.playerEngineHidden, false)
                : null}
            <View
              style={[
                styles.body,
                expanded && styles.expandedBody,
                widePlayer && styles.desktopBody,
              ]}
            >
              {expanded ? (
                <ScrollView
                  style={[
                    styles.trackPane,
                    widePlayer && styles.desktopTrackPane,
                    widePlayer &&
                      (visiblePlayerStyle === "integrated"
                        ? styles.desktopTrackPaneIntegrated
                        : styles.desktopTrackPaneClassic),
                    widePlayer &&
                      visiblePlayerStyle === "classic" && {
                        width: classicVideoWidth,
                        maxWidth: classicVideoWidth,
                        alignSelf: "center",
                      },
                  ]}
                  contentContainerStyle={[
                    styles.trackList,
                    phonePlayer && styles.phoneTrackList,
                    widePlayer && styles.desktopTrackList,
                    touchTablet && styles.tabletTrackList,
                    widePlayer &&
                      visiblePlayerStyle === "classic" && {
                        maxWidth: classicVideoWidth,
                      },
                  ]}
                  scrollEnabled
                  showsVerticalScrollIndicator={false}
                  alwaysBounceVertical
                  bounces
                  nestedScrollEnabled
                  directionalLockEnabled
                  canCancelContentTouches
                  overScrollMode="always"
                  decelerationRate="normal"
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  scrollEventThrottle={16}
                >
                  <View style={[styles.queueHeader, touchTablet && styles.tabletQueueHeader]}>
                    <View style={styles.queueHeading}>
                      <Text style={styles.queueEyebrow}>
                        {session.isTutorial ? "TUTORIALES" : "PLAY LIST"}
                      </Text>
                      <Text style={styles.queueTitle}>{session.title}</Text>
                    </View>
                    <Text style={styles.queueCount}>
                      {session.tracks.length}{" "}
                      {session.tracks.length === 1 ? "pista" : "pistas"}
                    </Text>
                  </View>
                  {widePlayer ? (
                    <View style={[styles.videoSizeSelector, touchTablet && styles.tabletVideoSizeSelector]}>
                      <Text style={styles.videoSizeLabel}>TAMAÑO DEL VÍDEO</Text>
                      {[
                        ["small", "Pequeño"],
                        ["medium", "Mediano"],
                        ["large", "Grande"],
                      ].map(([size, label]) => (
                        <Pressable
                          key={size}
                          accessibilityRole="button"
                          accessibilityState={{ selected: integratedSize === size }}
                          onPress={() => setIntegratedSize(size)}
                          style={[
                            styles.videoSizeButton,
                            integratedSize === size && styles.videoSizeButtonActive,
                          ]}
                        >
                          <Text style={styles.videoSizeButtonText}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
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
                    if (!active || visiblePlayerStyle === "classic") return null;
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
                        onLayout={phoneCard ? (event) => {
                          const measuredWidth = event.nativeEvent.layout.width;
                          if (measuredWidth > 0 && Math.abs(measuredWidth - phoneCardWidth) > 1) {
                            setPhoneCardWidth(measuredWidth);
                          }
                        } : undefined}
                        style={[
                          styles.track,
                          widePlayer && styles.embeddedVideoTrack,
                          !wideTransport && styles.trackMobile,
                          phoneCard && styles.phoneVideoCard,
                          phoneCard && { height: phoneVideoHeight + phoneControlsHeight },
                          widePlayer && {
                            maxWidth: integratedDimensions.card,
                            height: integratedDimensions.height,
                          },
                        ]}
                      >
                        {visiblePlayerStyle === "integrated" ? (
                          <View
                            style={[
                              styles.embeddedVideo,
                              !widePlayer && styles.embeddedVideoMobile,
                              phoneCard && styles.phoneCardVideo,
                              phoneCard && { height: phoneVideoHeight },
                              widePlayer && {
                                width: integratedDimensions.video,
                                height: integratedDimensions.height,
                              },
                            ]}
                          >
                            {renderPlayerSurface(styles.playerEngineEmbedded)}
                          </View>
                        ) : (
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
                            {imageId ? (
                              <Image
                                source={{
                                  uri: `https://i.ytimg.com/vi/${imageId}/mqdefault.jpg`,
                                }}
                                style={[
                                  styles.cardArtwork,
                                  !wideTransport && styles.cardArtworkMobile,
                                ]}
                                resizeMode="contain"
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
                        )}

                        {phoneCard ? (
                          <View style={styles.phoneTransport}>
                            <View style={styles.phoneTimeRow}>
                              <Text style={styles.phoneTimeText}>{formatTime(elapsed)}</Text>
                              <Text style={styles.phoneTimeText}>{duration ? formatTime(duration) : "—:—"}</Text>
                            </View>
                            <Slider
                              style={styles.phoneTransportProgress}
                              minimumValue={0}
                              maximumValue={Math.max(duration || 0, 1)}
                              value={Math.min(elapsed || 0, Math.max(duration || 0, 1))}
                              disabled={!status.ready || !duration}
                              onSlidingComplete={(value) => player.current?.seek(value)}
                              minimumTrackTintColor="#ec1970"
                              maximumTrackTintColor="#dff3ff"
                              thumbTintColor="transparent"
                            />
                            <View style={styles.phoneLyricRow}>
                              <SyncedLyricLine
                                track={item}
                                uri={lyricsUri}
                                time={elapsed}
                                compact
                                fallback="Letra no disponible"
                              />
                            </View>
                            <View style={styles.phoneTransportButtons}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Repetir canción"
                                accessibilityState={{ selected: repeat }}
                                onPress={() => setRepeat((value) => !value)}
                                style={styles.phoneTransportButton}
                              >
                                <Ionicons name="repeat" size={20} color={repeat ? "#ec1970" : "#9aa0a6"} />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Canción anterior"
                                onPress={() => selectRelative(-1)}
                                style={styles.phoneTransportButton}
                              >
                                <Ionicons name="play-skip-back" size={22} color="#202124" />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={tr(itemPlaying ? `Pausar ${item.title}` : `Reproducir ${item.title}`)}
                                disabled={!status.ready || Boolean(status.error)}
                                onPress={() => select(index)}
                                style={styles.phoneTransportPlay}
                              >
                                <Ionicons name={itemPlaying ? "pause" : "play"} size={21} color="#202124" />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Detener canción"
                                disabled={!status.ready}
                                onPress={stopCurrentTrack}
                                style={[styles.phoneTransportButton, !status.ready && styles.trackStopButtonDisabled]}
                              >
                                <Ionicons name="stop" size={20} color="#202124" />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Canción siguiente"
                                onPress={() => selectRelative(1)}
                                style={styles.phoneTransportButton}
                              >
                                <Ionicons name="play-skip-forward" size={22} color="#202124" />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Orden aleatorio"
                                accessibilityState={{ selected: shuffle }}
                                onPress={() => setShuffle((value) => !value)}
                                style={styles.phoneTransportButton}
                              >
                                <Ionicons name="shuffle" size={20} color={shuffle ? "#ec1970" : "#9aa0a6"} />
                              </Pressable>
                              <Pressable
                                accessibilityRole="link"
                                accessibilityLabel={tr(`Abrir ${cardTitle} en YouTube`)}
                                onPress={() => openTrackExternal(item, active)}
                                style={styles.phoneTransportButton}
                              >
                                <Ionicons name="logo-youtube" size={22} color="#ff0000" />
                              </Pressable>
                            </View>
                          </View>
                        ) : <View
                          style={[
                            styles.cardRight,
                            !wideTransport && styles.cardRightMobile,
                            widePlayer && { height: integratedDimensions.height },
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
                              <SyncedLyricLine
                                track={item}
                                uri={
                                  active
                                    ? lyricsUri
                                    : item.lyricsUri || item.lyricsUrl
                                }
                                time={elapsed}
                                compact={!wideTransport}
                              />
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
                            {!phoneCard && <Pressable
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
                            </Pressable>}
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
                              {!phoneCard && <Pressable
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
                              </Pressable>}
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
                            {!phoneCard && <Pressable
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
                            </Pressable>}
                            {!phoneCard && <Pressable
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
                            </Pressable>}
                          </View>
                        </View>}
                      </View>
                    );
                  })}
                  <View
                    style={[
                      styles.queueSection,
                      phonePlayer && styles.phoneQueueSection,
                      widePlayer &&
                        visiblePlayerStyle === "classic" && { maxWidth: classicVideoWidth },
                    ]}
                  >
                    <View style={styles.queueSectionHeader}>
                      <Text style={styles.queueSectionEyebrow}>LISTA DE PISTAS</Text>
                      <Text style={styles.queueSectionCount}>
                        {session.tracks.length} {session.tracks.length === 1 ? "pista" : "pistas"}
                      </Text>
                    </View>
                    {phonePlayer ? <View style={styles.queueRows}>
                      {session.tracks.map(renderQueueRow)}
                    </View> : <ScrollView
                      style={[
                        styles.queueRowsScroll,
                        { maxHeight: queueRowsMaxHeight },
                      ]}
                      contentContainerStyle={styles.queueRows}
                      nestedScrollEnabled
                      scrollEnabled={session.tracks.length > 1}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      {session.tracks.map(renderQueueRow)}
                    </ScrollView>}
                  </View>
                  {track.kind === "album" && ids.length > 0 ? (
                    <View style={styles.albumVideos}>
                      <Text style={styles.trackTitle}>
                        Vídeos de {track.title}
                      </Text>
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
                            source={{
                              uri: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
                            }}
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
                  ) : null}
                </ScrollView>
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
  expanded: { top: 0, left: 0, right: 0, bottom: 0 },
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
  title: { fontSize: 14, fontWeight: "800", color: "#f9fafb" },
  styleSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 4,
    padding: 3,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
  },
  styleSelectorButton: { minHeight: 28, paddingHorizontal: 8, justifyContent: "center" },
  styleSelectorButtonActive: { backgroundColor: "#ec1970" },
  styleSelectorText: { fontSize: 10, fontWeight: "800", color: "#f9fafb" },
  iconButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.35 },
  body: { minHeight: 0, flexShrink: 1 },
  expandedBody: { flex: 1, backgroundColor: "#0b0b0c" },
  desktopBody: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  desktopTrackPane: {
    width: "100%",
    minWidth: 0,
    alignSelf: "center",
  },
  desktopTrackPaneClassic: { maxWidth: 900 },
  desktopTrackPaneIntegrated: { maxWidth: 900 },
  desktopLyricsPanel: {
    flex: 0.92,
    minWidth: 340,
    maxWidth: 560,
    borderLeftWidth: 1,
    borderLeftColor: "#29292d",
    paddingLeft: 24,
    paddingTop: 18,
    paddingBottom: 18,
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
  playerEngine: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
  playerEnginePreview: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    aspectRatio: 16 / 9,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#29292d",
  },
  tabletPlayerEnginePreview: {
    marginTop: 8,
    marginBottom: 2,
  },
  playerEngineHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    left: -2,
    top: 52,
    opacity: 0.001,
  },
  playerEngineEmbedded: { width: "100%", height: "100%" },
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
    minHeight: 120,
    backgroundColor: "#0b0b0c",
    ...Platform.select({
      web: {
        touchAction: "pan-y",
        overscrollBehaviorY: "contain",
        WebkitOverflowScrolling: "touch",
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
  phoneTrackList: { flexGrow: 1, paddingHorizontal: 10, paddingBottom: 12 },
  phoneQueueSection: { flexGrow: 1, marginTop: 6 },
  desktopTrackList: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 0,
    paddingTop: 18,
    gap: 10,
  },
  tabletTrackList: {
    paddingTop: 8,
    gap: 6,
  },
  queueHeader: {
    width: "100%",
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3,
    paddingBottom: 8,
  },
  tabletQueueHeader: {
    minHeight: 52,
    paddingBottom: 2,
  },
  videoSizeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    paddingBottom: 12,
  },
  tabletVideoSizeSelector: {
    gap: 6,
    paddingBottom: 6,
  },
  videoSizeLabel: { color: "#9ca3af", fontSize: 10, fontWeight: "800", marginRight: 4 },
  videoSizeButton: {
    borderWidth: 1,
    borderColor: "#52525b",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  videoSizeButtonActive: { borderColor: "#ec1970", backgroundColor: "#ec1970" },
  videoSizeButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  queueHeading: { flex: 1, minWidth: 0 },
  queueEyebrow: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "900",
    color: "#ef4444",
  },
  queueTitle: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: "900",
    color: "#f9fafb",
  },
  queueCount: { fontSize: 11, color: "#9ca3af" },
  queueSection: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#29292d",
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
  queueRows: { gap: 6, paddingBottom: 12 },
  queueRow: {
    minHeight: 48,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#29292d",
    backgroundColor: "#151518",
    ...Platform.select({ web: { touchAction: "pan-y" } }),
  },
  queueRowActive: {
    borderColor: "#ec1970",
    backgroundColor: "#24131d",
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
  embeddedVideoTrack: { maxWidth: 720, aspectRatio: undefined },
  embeddedVideo: {
    width: 249,
    height: "100%",
    flexShrink: 0,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  embeddedVideoMobile: {
    width: 120,
    height: 68,
    alignSelf: "center",
    marginHorizontal: 10,
  },
  phoneVideoCard: {
    flexDirection: "column",
  },
  phoneCardVideo: {
    width: "100%",
    marginHorizontal: 0,
  },
  phoneTransport: { width: "100%", height: 140, backgroundColor: "#fff" },
  phoneTimeRow: {
    height: 30,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  phoneTimeText: { color: "#65696e", fontSize: 13, fontVariant: ["tabular-nums"] },
  phoneTransportProgress: { width: "100%", height: 8 },
  phoneLyricRow: { height: 38, paddingHorizontal: 14, justifyContent: "center" },
  phoneLyricEmpty: { color: "#85898f", fontSize: 12 },
  phoneTransportButtons: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 6,
  },
  phoneTransportButton: { width: 38, height: 48, alignItems: "center", justifyContent: "center" },
  phoneTransportPlay: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: "#202124",
    alignItems: "center",
    justifyContent: "center",
  },
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
