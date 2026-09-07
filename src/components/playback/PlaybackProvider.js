import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { I18nText as Text } from "@/src/i18n";
import YouTubeSurface from "./YouTubeSurface";
import { formatTime, normalizeTrack, parseLrc } from "./youtubeUtils";

const PlaybackContext = createContext(null);
const EMPTY_STATUS = { state: -1, time: 0, duration: 0, ready: false, videoIds: [], playlistIndex: 0 };
export function usePlayback() {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("PlaybackProvider is required");
  return value;
}
function IconButton({ name, label, onPress, disabled = false }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.iconButton, disabled && styles.disabled]}>
    <Ionicons name={name} size={23} color="#334155" />
  </Pressable>;
}
function Lyrics({ uri, time }) {
  const [lines, setLines] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setLines([]);
    if (uri) fetch(uri).then((r) => r.ok ? r.text() : "").then((text) => {
      if (!cancelled) setLines(parseLrc(text));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [uri]);
  if (!lines.length) return null;
  let index = -1;
  lines.forEach((line, i) => { if (line.time <= time + 0.08) index = i; });
  return <View style={styles.lyrics}>
    <Text style={styles.lyricAdjacent} numberOfLines={1}>{lines[index - 1]?.text || ""}</Text>
    <Text style={styles.lyricActive}>{lines[index]?.text || "♪"}</Text>
    <Text style={styles.lyricAdjacent} numberOfLines={1}>{lines[index + 1]?.text || ""}</Text>
  </View>;
}

export default function PlaybackProvider({ children }) {
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const [expanded, setExpanded] = useState(true);
  const [status, setStatus] = useState(EMPTY_STATUS);
  const player = useRef(null);
  const serial = useRef(0);
  const rememberedTimes = useRef(new Map());
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const installSession = useCallback((value) => {
    // The keyed surface destroys the old iframe/WebView before creating the next one.
    const next = value ? { ...value, requestId: ++serial.current } : null;
    player.current?.pause();
    sessionRef.current = next;
    setStatus(EMPTY_STATUS);
    setSession(next);
  }, []);
  const open = useCallback((playlist, { isTutorial = false } = {}) => {
    const tracks = (playlist?.tracks || []).map(normalizeTrack).filter(Boolean);
    if (!tracks.length) return;
    const sourceKey = JSON.stringify([playlist._id || playlist.title, tracks]);
    if (sessionRef.current?.sourceKey !== sourceKey) {
      installSession({ title: playlist.title || "YouTube", tracks, index: 0, isTutorial, sourceKey, resumeTime: 0 });
    }
    setExpanded(true);
  }, [installSession]);
  const stop = useCallback(() => installSession(null), [installSession]);
  const context = useMemo(() => ({ open, stop }), [open, stop]);
  useEffect(() => {
    if (!session || !expanded) return undefined;
    if (Platform.OS === "web") {
      const onKey = (event) => {
        if (event.key === "Escape") { event.preventDefault(); setExpanded(false); }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { setExpanded(false); return true; });
    return () => subscription.remove();
  }, [Boolean(session), expanded]);
  const track = session?.tracks[session.index];
  const trackKey = (item) => `${item?.kind || "single"}:${item?.videoId || item?.playlistId || item?.url || ""}`;
  const select = (index) => {
    if (index === session.index) {
      playing ? player.current?.pause() : player.current?.play();
      return;
    }
    rememberedTimes.current.set(trackKey(track), status.time || 0);
    installSession({
      ...session,
      index,
      resumeTime: rememberedTimes.current.get(trackKey(session.tracks[index])) || 0,
    });
  };
  const ids = status.videoIds || [];
  const albumIndex = status.playlistIndex || 0;
  const canPrevious = Boolean(session && (session.index > 0 || (track.kind === "album" && albumIndex > 0)));
  const canNext = Boolean(session && (session.index < session.tracks.length - 1 || (track.kind === "album" && albumIndex < ids.length - 1)));
  const step = (direction) => {
    if (track.kind === "album" && ids.length && albumIndex + direction >= 0 && albumIndex + direction < ids.length) {
      player.current?.selectVideo(albumIndex + direction);
    } else if (session.tracks[session.index + direction]) select(session.index + direction);
  };
  const desktop = expanded && width >= 900;
  const miniWidth = Math.min(360, Math.max(200, width - 16));
  const frameWidth = expanded ? Math.min(desktop ? width * 0.60 - 32 : width - 24, 960) : miniWidth;
  const bottom = Platform.OS === "web" ? "calc(78px + env(safe-area-inset-bottom, 0px))" : 70 + Math.max(insets.bottom, 10);
  const playing = status.state === 1 || status.state === 3;
  const currentTitle = track?.kind === "album" ? status.videoTitle || track.title : track?.title;
  const openExternal = async () => {
    player.current?.pause();
    const id = status.videoId || track.videoId;
    const url = id ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/playlist?list=${track.playlistId}`;
    try { await Linking.openURL(url); } catch { setStatus((value) => ({ ...value, error: "No se pudo abrir YouTube." })); }
  };
  return <PlaybackContext.Provider value={context}>
    <View style={styles.root}>
      {children}
      {session ? <View accessibilityViewIsModal={expanded} style={[styles.player, expanded ? [styles.expanded, { paddingTop: insets.top, paddingBottom: insets.bottom }] : [styles.mini, { width: miniWidth, bottom, maxHeight: Math.max(220, height - 100 - insets.top - insets.bottom) }]]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={expanded ? "Minimizar reproductor" : "Ampliar reproductor"}
            onPress={() => setExpanded((value) => !value)} style={styles.heading}>
            <Text numberOfLines={1} style={styles.title}>{expanded ? session.title : currentTitle || session.title}</Text>
          </Pressable>
          {!expanded ? <IconButton name={playing ? "pause" : "play"}
            label={playing ? `Pausar ${currentTitle || session.title}` : `Reproducir ${currentTitle || session.title}`}
            disabled={!status.ready || Boolean(status.error)}
            onPress={() => playing ? player.current?.pause() : player.current?.play()} /> : null}
          <IconButton name={expanded ? "remove-outline" : "expand-outline"} label={expanded ? "Minimizar reproductor" : "Ampliar reproductor"} onPress={() => setExpanded((value) => !value)} />
          <IconButton name="close-outline" label="Detener y cerrar reproductor" onPress={stop} />
        </View>
        <View style={[styles.body, expanded && styles.expandedBody, desktop && styles.desktopBody]}>
          <ScrollView style={[styles.media, desktop && styles.desktopMedia]} contentContainerStyle={styles.mediaContent}>
            <View style={{ width: frameWidth, maxWidth: "100%", height: Math.max(200, frameWidth * 9 / 16), backgroundColor: "#000" }}>
              <YouTubeSurface key={session.requestId} ref={player} track={track}
                initialTime={session.resumeTime || 0}
                onStatus={(next) => {
                if (sessionRef.current?.requestId !== session.requestId) return;
                if (Number.isFinite(next.time)) {
                  rememberedTimes.current.set(trackKey(track), next.state === 0 ? 0 : next.time);
                }
                setStatus((value) => ({ ...value, ...next }));
              }} />
            </View>
            <View style={styles.controls}>
              <View style={styles.controlText}>
                <Text style={styles.nowPlaying} numberOfLines={1}>{expanded ? currentTitle : playing ? "Reproduciendo" : status.ready ? "En pausa" : "Cargando…"}</Text>
                <Text style={styles.time}>{formatTime(status.time)} / {formatTime(status.duration)}</Text>
              </View>
              <IconButton name="open-outline" label="Pausar y abrir en YouTube" onPress={openExternal} />
            </View>
            <Slider style={styles.slider} accessibilityLabel="Posición de reproducción" minimumValue={0} maximumValue={Math.max(1, status.duration)}
              value={Math.min(status.time, status.duration || 0)} disabled={!status.ready || !status.duration}
              onSlidingComplete={(time) => player.current?.seek(time)} minimumTrackTintColor="#dc2626" maximumTrackTintColor="#cbd5e1" thumbTintColor="#dc2626" />
            {status.error ? <View style={styles.message}>
              <Text style={styles.error}>{status.error}</Text>
              <Pressable accessibilityRole="button" onPress={() => installSession(session)}><Text style={styles.retry}>Reintentar</Text></Pressable>
            </View> : status.notice ? <Text style={styles.notice}>{status.notice}</Text> : null}
            {expanded ? <Lyrics key={session.requestId} uri={track.lyricsUri || track.lyricsUrl} time={status.time} /> : null}
          </ScrollView>
          {expanded ? <ScrollView style={[styles.trackPane, desktop && styles.desktopTracks]} contentContainerStyle={styles.trackList}>
            {session.tracks.map((item, index) => {
              const active = index === session.index;
              const itemPlaying = active && playing;
              return <View key={index} style={[styles.track, active && styles.activeTrack]}>
              <Pressable onPress={() => select(index)} accessibilityRole="button"
                accessibilityLabel={itemPlaying ? `Pausar ${item.title}` : `Reproducir ${item.title}`}
                accessibilityState={{ selected: active }} style={styles.trackMain}>
              {item.videoId ? <Image source={{ uri: `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` }} style={styles.thumbnail} />
                : <View style={[styles.thumbnail, styles.fallback]}><Ionicons name="albums-outline" size={26} color="#dc2626" /></View>}
              <View style={styles.trackText}>
                <Text style={styles.meta}>{item.kind === "album" ? session.isTutorial ? "Serie" : "Álbum" : session.isTutorial ? "Vídeo" : "Single"} {index + 1}</Text>
                <Text style={styles.trackTitle} numberOfLines={2}>{item.title}</Text>
                {item.lyricsFileName ? <Text style={styles.meta}>Letras · {item.lyricsFileName}</Text> : null}
              </View>
              </Pressable>
              <Pressable accessibilityRole="button"
                accessibilityLabel={itemPlaying ? `Pausar ${item.title}` : `Reproducir ${item.title}`}
                disabled={active && (!status.ready || Boolean(status.error))}
                onPress={() => select(index)} style={styles.trackPlayButton}>
                <Ionicons name={itemPlaying ? "pause-circle" : "play-circle-outline"} size={27}
                  color={active ? "#dc2626" : "#64748b"} />
              </Pressable>
            </View>})}
            {track.kind === "album" && ids.length > 0 ? <View style={styles.albumVideos}>
              <Text style={styles.trackTitle}>Vídeos de {track.title}</Text>
              {ids.map((id, index) => <Pressable key={`${id}:${index}`} onPress={() => player.current?.selectVideo(index)} accessibilityRole="button"
                accessibilityLabel={`Reproducir vídeo ${index + 1}`} style={[styles.track, index === albumIndex && styles.activeTrack]}>
                <Image source={{ uri: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` }} style={styles.thumbnail} />
                <Text style={styles.trackText}>{index === albumIndex && status.videoTitle ? status.videoTitle : `Vídeo ${index + 1}`}</Text>
              </Pressable>)}
            </View> : null}
          </ScrollView> : null}
        </View>
      </View> : null}
    </View>
  </PlaybackContext.Provider>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  player: { position: "absolute", backgroundColor: "#fff", zIndex: 1000, elevation: 30, borderWidth: 1, borderColor: "#cbd5e1" },
  expanded: { top: 0, left: 0, right: 0, bottom: 0 },
  mini: { right: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
  header: { flexDirection: "row", alignItems: "center", minHeight: 44, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  heading: { flex: 1, minWidth: 0, paddingLeft: 12 },
  title: { fontSize: 14, fontWeight: "800", color: "#111827" },
  iconButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  body: { minHeight: 0, flexShrink: 1 },
  expandedBody: { flex: 1, padding: 10, gap: 10 },
  desktopBody: { flexDirection: "row" },
  media: { flexGrow: 0, flexShrink: 1 },
  mediaContent: { alignItems: "center" },
  desktopMedia: { flex: 1.6 },
  controls: { width: "100%", flexDirection: "row", alignItems: "center" },
  controlText: { flex: 1, minWidth: 0, paddingHorizontal: 3 },
  nowPlaying: { fontSize: 12, fontWeight: "700", color: "#334155" },
  time: { fontSize: 11, color: "#64748b", marginTop: 3 },
  slider: { width: "100%", height: 28 },
  trackPane: { flex: 1, minHeight: 90 },
  desktopTracks: { flex: 1, borderLeftWidth: 1, borderLeftColor: "#e2e8f0", paddingLeft: 10 },
  trackList: { gap: 8, paddingBottom: 18 },
  track: { padding: 7, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  trackMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  trackPlayButton: { width: 46, minHeight: 54, alignItems: "center", justifyContent: "center" },
  activeTrack: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  thumbnail: { width: 92, height: 52, backgroundColor: "#f1f5f9" },
  fallback: { alignItems: "center", justifyContent: "center" },
  trackText: { flex: 1, minWidth: 0 },
  trackTitle: { fontSize: 13, fontWeight: "700", color: "#334155" },
  meta: { fontSize: 10, color: "#64748b", marginVertical: 3 },
  albumVideos: { gap: 7, paddingTop: 10 },
  lyrics: { width: "100%", padding: 16, backgroundColor: "#111827", alignItems: "center", gap: 8 },
  lyricAdjacent: { fontSize: 12, color: "#94a3b8", minHeight: 16 },
  lyricActive: { fontSize: 19, fontWeight: "700", textAlign: "center", color: "#fff" },
  message: { width: "100%", padding: 10, gap: 8 },
  error: { color: "#b91c1c", fontSize: 12 },
  retry: { color: "#2563eb", fontWeight: "700", paddingVertical: 5 },
  notice: { fontSize: 12, color: "#64748b", padding: 8 },
});
