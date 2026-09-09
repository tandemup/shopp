import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { I18nText as Text, tr } from "@/src/i18n";
import YouTubeSurface from "./YouTubeSurface";
import { formatTime, normalizeTrack, parseLrc } from "./youtubeUtils";

const PlaybackContext = createContext(null);
const EMPTY_STATUS = { state: -1, time: 0, duration: 0, ready: false, videoIds: [], playlistIndex: 0 };
const trackKey = (item) => `${item?.kind || "single"}:${item?.videoId || item?.playlistId || item?.url || ""}`;
export function usePlayback() {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("PlaybackProvider is required");
  return value;
}
function IconButton({ name, label, onPress, disabled = false }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.iconButton, disabled && styles.disabled]}>
    <Ionicons name={name} size={23} color="#e5e7eb" />
  </Pressable>;
}
function SecondSeekButton({ direction, onPress, disabled = false }) {
  const backward = direction < 0;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={tr(backward ? "Retroceder 1 segundo" : "Avanzar 1 segundo")}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={[styles.trackNavButton, disabled && styles.disabled]}
  >
    <Ionicons
      name={backward ? "play-back" : "play-forward"}
      size={25}
      color="#f3f4f6"
    />
  </Pressable>;
}
function SyncedLyricLine({ uri, time }) {
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
  const text = lines[index]?.text || lines[0]?.text;
  if (!text) return null;
  return <View style={styles.cardLyric}>
    <Ionicons name="musical-notes-outline" size={14} color="#dc2626" />
    <Text style={styles.cardLyricText} numberOfLines={2}>{text}</Text>
  </View>;
}

export default function PlaybackProvider({ children }) {
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const [expanded, setExpanded] = useState(true);
  const [status, setStatus] = useState(EMPTY_STATUS);
  const statusRef = useRef(EMPTY_STATUS);
  const player = useRef(null);
  const serial = useRef(0);
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
      playlistIndex: currentStatus.playlistIndex || 0,
    });
  }, []);
  const open = useCallback((playlist, { isTutorial = false } = {}) => {
    const tracks = (playlist?.tracks || []).map(normalizeTrack).filter(Boolean);
    if (!tracks.length) return;
    const sourceKey = JSON.stringify([playlist._id || playlist.title, tracks]);
    if (sessionRef.current?.sourceKey !== sourceKey) {
      rememberCurrentPlayback();
      const remembered = rememberedPlayback.current.get(trackKey(tracks[0]));
      installSession({
        title: playlist.title || "YouTube",
        tracks,
        index: 0,
        isTutorial,
        sourceKey,
        resumeTime: remembered?.time || 0,
        resumePlaylistIndex: remembered?.playlistIndex || 0,
        autoPlay: false,
      });
    }
    setExpanded(true);
  }, [installSession, rememberCurrentPlayback]);
  const stop = useCallback(() => {
    rememberCurrentPlayback();
    installSession(null);
  }, [installSession, rememberCurrentPlayback]);
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
  const lyricsUri = track?.lyricsUri || track?.lyricsUrl;
  const select = (index) => {
    if (index === session.index) {
      playing ? player.current?.pause() : player.current?.play();
      return;
    }
    rememberCurrentPlayback();
    const remembered = rememberedPlayback.current.get(trackKey(session.tracks[index]));
    installSession({
      ...session,
      index,
      resumeTime: remembered?.time || 0,
      resumePlaylistIndex: remembered?.playlistIndex || 0,
      autoPlay: true,
    });
  };
  const ids = status.videoIds || [];
  const albumIndex = status.playlistIndex || 0;
  const desktop = expanded && width >= 760;
  const wideTransport = width >= 560;
  const miniWidth = Math.min(360, Math.max(200, width - 16));
  const bottom = Platform.OS === "web" ? "calc(78px + env(safe-area-inset-bottom, 0px))" : 70 + Math.max(insets.bottom, 10);
  const playing = status.state === 1 || status.state === 3;
  const seekBy = (seconds) => {
    if (!status.ready || !status.duration || status.error) return;
    const nextTime = Math.min(status.duration, Math.max(0, status.time + seconds));
    statusRef.current = { ...statusRef.current, time: nextTime };
    setStatus((value) => ({ ...value, time: nextTime }));
    player.current?.seek(nextTime);
  };
  const currentTitle = track?.kind === "album" ? status.videoTitle || track.title : track?.title;
  const openExternal = async () => {
    player.current?.pause();
    const id = status.videoId || track.videoId;
    const url = id ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/playlist?list=${track.playlistId}`;
    try { await Linking.openURL(url); } catch { setStatus((value) => ({ ...value, error: "No se pudo abrir YouTube." })); }
  };
  const openTrackExternal = async (item, active = false) => {
    player.current?.pause();
    const videoId = active ? status.videoId || item.videoId : item.videoId;
    const url = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : `https://www.youtube.com/playlist?list=${item.playlistId}`;
    try { await Linking.openURL(url); } catch { setStatus((value) => ({ ...value, error: "No se pudo abrir YouTube." })); }
  };
  return <PlaybackContext.Provider value={context}>
    <View style={styles.root}>
      {children}
      {session ? <View accessibilityViewIsModal={expanded} style={[styles.player, expanded ? [styles.expanded, { paddingTop: insets.top, paddingBottom: insets.bottom }] : [styles.mini, { width: miniWidth, bottom, maxHeight: Math.max(220, height - 100 - insets.top - insets.bottom) }]]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={tr(expanded ? "Minimizar reproductor" : "Ampliar reproductor")}
            onPress={() => setExpanded((value) => !value)} style={styles.heading}>
            <Text numberOfLines={1} style={styles.title}>{expanded ? session.title : currentTitle || session.title}</Text>
          </Pressable>
          {!expanded ? <IconButton name={playing ? "pause" : "play"}
            label={tr(playing ? `Pausar ${currentTitle || session.title}` : `Reproducir ${currentTitle || session.title}`)}
            disabled={!status.ready || Boolean(status.error)}
            onPress={() => playing ? player.current?.pause() : player.current?.play()} /> : null}
          <IconButton name={expanded ? "remove-outline" : "expand-outline"} label={tr(expanded ? "Minimizar reproductor" : "Ampliar reproductor")} onPress={() => setExpanded((value) => !value)} />
          <IconButton name="close-outline" label={tr("Detener y cerrar reproductor")} onPress={stop} />
        </View>
        <View pointerEvents="none" style={styles.playerEngine}>
          <YouTubeSurface key={session.requestId} ref={player} track={track}
            initialTime={session.resumeTime || 0}
            initialPlaylistIndex={session.resumePlaylistIndex || 0}
            autoPlay={Boolean(session.autoPlay)}
            onStatus={(next) => {
            if (sessionRef.current?.requestId !== session.requestId) return;
            const mergedStatus = { ...statusRef.current, ...next };
            statusRef.current = mergedStatus;
            if (Number.isFinite(next.time)) {
              rememberedPlayback.current.set(trackKey(track), {
                time: mergedStatus.state === 0 ? 0 : mergedStatus.time || 0,
                playlistIndex: mergedStatus.playlistIndex || 0,
              });
            }
            setStatus(mergedStatus);
          }} />
        </View>
        <View style={[styles.body, expanded && styles.expandedBody]}>
          {expanded ? <ScrollView
            style={styles.trackPane}
            contentContainerStyle={[styles.trackList, desktop && styles.desktopTrackList]}
            scrollEnabled
            showsVerticalScrollIndicator
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
            <View style={styles.queueHeader}>
              <View style={styles.queueHeading}>
                <Text style={styles.queueEyebrow}>{session.isTutorial ? "TUTORIALES" : "PLAY LIST"}</Text>
                <Text style={styles.queueTitle}>{session.title}</Text>
              </View>
              <Text style={styles.queueCount}>{session.tracks.length} {session.tracks.length === 1 ? "pista" : "pistas"}</Text>
            </View>
            {status.error ? <View style={styles.message}>
              <Text style={styles.error}>{status.error}</Text>
              <View style={styles.errorActions}>
                <Pressable accessibilityRole="button" onPress={() => installSession(session)}><Text style={styles.retry}>Reintentar</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={openExternal}><Text style={styles.retry}>Abrir en YouTube</Text></Pressable>
              </View>
            </View> : status.notice ? <Text style={styles.notice}>{status.notice}</Text> : null}
            {session.tracks.map((item, index) => {
              const active = index === session.index;
              const itemPlaying = active && playing;
              const remembered = rememberedPlayback.current.get(trackKey(item));
              const elapsed = active ? status.time : remembered?.time || 0;
              const imageId = active && status.videoId ? status.videoId : item.videoId;
              const cardTitle = active ? currentTitle || item.title : item.title;
              return <View key={index} style={[styles.track, active && styles.activeTrack]}>
                <View style={[styles.cardTop, (desktop || wideTransport) && styles.desktopCardTop]}>
                  <Pressable onPress={() => select(index)} accessibilityRole="button"
                    accessibilityLabel={tr(itemPlaying ? `Pausar ${item.title}` : `Reproducir ${item.title}`)}
                    accessibilityState={{ selected: active }} style={[styles.trackMain, styles.activeTrackMain, wideTransport && styles.wideTrackMain]}>
                  {imageId ? <Image source={{ uri: `https://i.ytimg.com/vi/${imageId}/mqdefault.jpg` }} style={[styles.thumbnail, styles.activeThumbnail, wideTransport && styles.wideThumbnail]} />
                    : <View style={[styles.thumbnail, styles.activeThumbnail, wideTransport && styles.wideThumbnail, styles.fallback]}><Ionicons name="albums-outline" size={26} color="#dc2626" /></View>}
                  </Pressable>
                </View>
                <View style={[styles.activeTransport, wideTransport && styles.sideTransport]}>
                  <View style={styles.cardHeadingRow}>
                    <Text style={styles.cardHeadingTitle} numberOfLines={1}>{cardTitle}</Text>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={tr(`Abrir ${cardTitle} en YouTube`)}
                      onPress={() => openTrackExternal(item, active)}
                      style={styles.youtubeButton}
                    >
                      <Ionicons name="logo-youtube" size={24} color="#ff0000" />
                    </Pressable>
                  </View>
                  <View style={[styles.transportTop, wideTransport && styles.wideTransport]}>
                    <View style={styles.playbackButtons}>
                      <SecondSeekButton direction={-1}
                        disabled={!active || !status.ready || !status.duration || status.time <= 0 || Boolean(status.error)}
                        onPress={() => seekBy(-1)} />
                      <Pressable accessibilityRole="button"
                        accessibilityLabel={tr(itemPlaying ? `Pausar ${item.title}` : `Reproducir ${item.title}`)}
                        disabled={active && (!status.ready || Boolean(status.error))}
                        onPress={() => select(index)} style={[styles.transportPlayButton, !active && styles.inactiveTransportPlayButton, itemPlaying && styles.transportPauseButton]}>
                          <Ionicons name={itemPlaying ? "pause" : "play"} size={23} color="#fff" />
                      </Pressable>
                      <SecondSeekButton direction={1}
                        disabled={!active || !status.ready || !status.duration || status.time >= status.duration || Boolean(status.error)}
                        onPress={() => seekBy(1)} />
                    </View>
                    <View style={styles.timelineBlock}>
                      <View style={styles.timeLabels}>
                        <Text style={styles.progressTime}>{formatTime(elapsed)}</Text>
                        <Text style={styles.transportTitle} numberOfLines={1}>{itemPlaying ? "Reproduciendo" : "En pausa"}</Text>
                        <Text style={styles.progressTime}>{active && status.duration ? `−${formatTime(Math.max(0, status.duration - status.time))}` : "—:—"}</Text>
                      </View>
                      <Slider style={styles.cardSlider} accessibilityLabel={tr(`Posición de ${item.title}`)}
                        minimumValue={0} maximumValue={active ? Math.max(1, status.duration) : 1}
                        value={active ? Math.min(status.time, status.duration || 0) : 0}
                        disabled={!active || !status.ready || !status.duration}
                        onSlidingComplete={(time) => player.current?.seek(time)}
                        minimumTrackTintColor="#f9fafb" maximumTrackTintColor="#6b7280" thumbTintColor="#f9fafb" />
                    </View>
                  </View>
                  {active && lyricsUri ? <SyncedLyricLine
                    key={session.requestId}
                    uri={lyricsUri}
                    time={status.time}
                  /> : <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cardLyricSpacer} />}
                </View>
              </View>})}
            {track.kind === "album" && ids.length > 0 ? <View style={styles.albumVideos}>
              <Text style={styles.trackTitle}>Vídeos de {track.title}</Text>
              {ids.map((id, index) => <Pressable key={`${id}:${index}`} onPress={() => player.current?.selectVideo(index)} accessibilityRole="button"
                accessibilityLabel={`Reproducir vídeo ${index + 1}`} style={[styles.track, styles.albumVideoRow, index === albumIndex && styles.activeTrack]}>
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
  player: { position: "absolute", backgroundColor: "#0b0b0c", zIndex: 1000, elevation: 30, borderWidth: 1, borderColor: "#29292d" },
  expanded: { top: 0, left: 0, right: 0, bottom: 0 },
  mini: { right: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
  header: { flexDirection: "row", alignItems: "center", minHeight: 52, borderBottomWidth: 1, borderBottomColor: "#29292d", backgroundColor: "#111113" },
  heading: { flex: 1, minWidth: 0, paddingLeft: 16 },
  title: { fontSize: 14, fontWeight: "800", color: "#f9fafb" },
  iconButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  body: { minHeight: 0, flexShrink: 1 },
  expandedBody: { flex: 1, backgroundColor: "#0b0b0c" },
  playerEngine: { position: "absolute", width: 320, height: 180, left: 0, top: 52, opacity: 0.001, zIndex: -1, overflow: "hidden" },
  media: { flexGrow: 0, flexShrink: 1, width: "100%", minWidth: 0 },
  mediaContent: { alignItems: "center", paddingBottom: 14 },
  desktopMedia: { flexGrow: 1.6, flexShrink: 1, flexBasis: 0, width: "auto", minWidth: 0 },
  mediaEyebrowRow: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 9 },
  mediaEyebrow: { fontSize: 10, letterSpacing: 1.3, fontWeight: "900", color: "#ef4444" },
  mediaSource: { fontSize: 11, fontWeight: "700", color: "#9ca3af" },
  videoFrame: { overflow: "hidden", backgroundColor: "#000", borderRadius: 8 },
  controls: { width: "100%", minHeight: 66, flexDirection: "row", alignItems: "center", paddingTop: 10 },
  controlText: { flex: 1, minWidth: 0, paddingHorizontal: 3 },
  nowPlaying: { fontSize: 16, fontWeight: "800", color: "#f9fafb" },
  collectionTitle: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  time: { fontSize: 11, color: "#d1d5db", marginTop: 5, fontVariant: ["tabular-nums"] },
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
      },
    }),
  },
  trackList: { gap: 10, padding: 10, paddingBottom: 30, ...Platform.select({ web: { touchAction: "pan-y" } }) },
  desktopTrackList: { width: "100%", maxWidth: 1040, alignSelf: "center", paddingHorizontal: 20, paddingTop: 18 },
  queueHeader: { width: "100%", minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3, paddingBottom: 8 },
  queueHeading: { flex: 1, minWidth: 0 },
  queueEyebrow: { fontSize: 9, letterSpacing: 1.2, fontWeight: "900", color: "#ef4444" },
  queueTitle: { marginTop: 3, fontSize: 18, fontWeight: "900", color: "#f9fafb" },
  queueCount: { fontSize: 11, color: "#9ca3af" },
  track: { width: "100%", padding: 10, gap: 8, borderWidth: 1, borderColor: "#303036", borderRadius: 8, backgroundColor: "#1a1a1e", ...Platform.select({ web: { touchAction: "pan-y" } }) },
  cardTop: { width: "100%", gap: 10 },
  desktopCardTop: { flexDirection: "row", alignItems: "center" },
  trackMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9, ...Platform.select({ web: { touchAction: "pan-y" } }) },
  activeTrackMain: { flex: 0, width: 118 },
  wideTrackMain: { width: 150 },
  trackControls: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingTop: 2 },
  desktopTrackControls: { width: "auto", flexShrink: 0, paddingTop: 0 },
  trackPlayButton: { width: 44, height: 38, borderRadius: 19, borderWidth: 1, borderColor: "#52525b", backgroundColor: "#27272a", alignItems: "center", justifyContent: "center" },
  activePlayButton: { borderColor: "#ef4444", backgroundColor: "#ef4444" },
  activeTransport: { width: "100%", minHeight: 108, gap: 7, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 0, backgroundColor: "transparent", justifyContent: "center" },
  sideTransport: { position: "absolute", width: "auto", left: 170, right: 10, top: 10, height: 150, minHeight: 0, justifyContent: "space-between" },
  transportTop: { width: "100%", gap: 7 },
  wideTransport: { flexDirection: "row", alignItems: "center", gap: 14 },
  playbackButtons: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  trackNavButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", ...Platform.select({ web: { touchAction: "pan-y" } }) },
  transportPlayButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#ef4444", ...Platform.select({ web: { touchAction: "pan-y" } }) },
  inactiveTransportPlayButton: { backgroundColor: "#3f3f46" },
  transportPauseButton: { backgroundColor: "#dc2626" },
  cardHeadingRow: { width: "100%", minHeight: 32, flexDirection: "row", alignItems: "center", gap: 8 },
  cardHeadingTitle: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontWeight: "900", color: "#f9fafb" },
  youtubeButton: { width: 40, height: 32, alignItems: "center", justifyContent: "center", ...Platform.select({ web: { touchAction: "pan-y" } }) },
  timelineBlock: { flex: 1, minWidth: 0, gap: 1 },
  timeLabels: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8 },
  transportTitle: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: "800", color: "#f3f4f6", textAlign: "center" },
  progressTime: { width: 43, fontSize: 12, fontWeight: "800", color: "#f3f4f6", fontVariant: ["tabular-nums"], textAlign: "center" },
  albumVideoRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  activeTrack: { borderColor: "#ef4444", backgroundColor: "#2a1719" },
  thumbnail: { width: 88, height: 88, borderRadius: 5, backgroundColor: "#27272a" },
  activeThumbnail: { width: 118, height: 118 },
  wideThumbnail: { width: 150, height: 150 },
  fallback: { alignItems: "center", justifyContent: "center" },
  trackText: { flex: 1, minWidth: 0 },
  trackTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800", color: "#f3f4f6" },
  trackTime: { marginTop: 7, fontSize: 12, fontWeight: "700", color: "#d1d5db", fontVariant: ["tabular-nums"] },
  meta: { fontSize: 10, color: "#9ca3af", marginVertical: 3 },
  albumVideos: { gap: 7, paddingTop: 10 },
  cardSlider: { width: "100%", height: 24, ...Platform.select({ web: { touchAction: "pan-x" } }) },
  cardLyric: { width: "100%", minHeight: 34, paddingHorizontal: 9, paddingVertical: 5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "transparent", borderRadius: 0 },
  cardLyricSpacer: { width: "100%", height: 34 },
  cardLyricText: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, fontWeight: "700", color: "#fecaca", textAlign: "center" },
  message: { width: "100%", padding: 10, gap: 8 },
  errorActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  error: { color: "#b91c1c", fontSize: 12 },
  retry: { color: "#2563eb", fontWeight: "700", paddingVertical: 5 },
  notice: { fontSize: 12, color: "#9ca3af", padding: 8 },
});
