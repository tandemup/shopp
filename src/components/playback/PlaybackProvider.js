import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { I18nText as Text, tr } from "@/src/i18n";
import YouTubeSurface from "./YouTubeSurface";
import { formatTime, normalizeTrack, parseLrc } from "./youtubeUtils";
import { getLocalLyrics } from "@/src/storage/lyricsStorage";

const PlaybackContext = createContext(null);
const EMPTY_STATUS = { state: -1, time: 0, duration: 0, ready: false, videoIds: [], playlistIndex: 0 };
const trackKey = (item) => `${item?.kind || "single"}:${item?.videoId || item?.playlistId || item?.url || ""}`;
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
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.iconButton, disabled && styles.disabled]}>
    <Ionicons name={name} size={23} color="#e5e7eb" />
  </Pressable>;
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
          fetch(uri).then((r) => r.ok ? r.text() : "").then((source) => {
            if (!cancelled) setLines(parseLrc(source));
          }).catch(() => {});
        }
      }
    })();
    return () => { cancelled = true; };
  }, [track?.videoId, track?.playlistId, track?.url, uri]);
  if (!lines.length) return null;
  let index = -1;
  lines.forEach((line, i) => { if (line.time <= time + 0.08) index = i; });
  const text = lines[index]?.text || lines[0]?.text;
  if (!text) return null;
  return <View style={styles.cardLyric}>
    <Ionicons name="musical-notes-outline" size={14} color="#dc2626" />
    <Text style={[styles.cardLyricText, compact && styles.cardLyricTextMobile]} numberOfLines={2}>{text}</Text>
  </View>;
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
    return () => { cancelled = true; };
  }, [track?.videoId, track?.playlistId, track?.url, uri]);
  let activeIndex = -1;
  lines.forEach((line, i) => { if (line.time <= time + 0.08) activeIndex = i; });
  useEffect(() => {
    if (activeIndex < 0) return;
    scrollRef.current?.scrollTo?.({ y: Math.max(0, activeIndex * 34 - 150), animated: true });
  }, [activeIndex]);
  return <View style={styles.desktopLyricsPanel}>
    <View style={styles.desktopLyricsHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.desktopLyricsEyebrow}>LETRA</Text>
        <Text style={styles.desktopLyricsTitle} numberOfLines={2}>{title || "Letra"}</Text>
      </View>
    </View>
    {!hasSource ? <View style={styles.desktopLyricsEmpty}>
      <Ionicons name="musical-notes-outline" size={28} color="#52525b" />
      <Text style={styles.desktopLyricsEmptyTitle}>La letra no está disponible</Text>
      <Text style={styles.desktopLyricsEmptyText}>No hay letra para esta canción.</Text>
    </View> : !lines.length ? <View style={styles.desktopLyricsEmpty}>
      <Text style={styles.desktopLyricsEmptyText}>Cargando letra…</Text>
    </View> : <ScrollView ref={scrollRef} style={styles.desktopLyricsScroll}
      contentContainerStyle={styles.desktopLyricsContent} showsVerticalScrollIndicator={false}>
      {lines.map((line, i) => <Text key={`${line.time}:${i}`}
        style={[styles.desktopLyricLine, i === activeIndex && styles.desktopLyricLineActive]}>
        {line.text}
      </Text>)}
    </ScrollView>}
  </View>;
}

export default function PlaybackProvider({ children }) {
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const [expanded, setExpanded] = useState(true);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [volume, setVolume] = useState(100);
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
      duration: currentStatus.duration || 0,
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
  const desktop = expanded && width >= 960;
  const wideTransport = width >= 760;
  const miniWidth = Math.min(360, Math.max(200, width - 16));
  const bottom = Platform.OS === "web" ? "calc(78px + env(safe-area-inset-bottom, 0px))" : 70 + Math.max(insets.bottom, 10);
  const playing = status.state === 1 || status.state === 3;
  const selectRelative = (direction) => {
    if (!session?.tracks?.length) return;
    if (shuffle && session.tracks.length > 1) {
      let next = session.index;
      while (next === session.index) next = Math.floor(Math.random() * session.tracks.length);
      select(next);
      return;
    }
    select((session.index + direction + session.tracks.length) % session.tracks.length);
  };
  useEffect(() => {
    if (!session || status.state !== 0) return;
    if (repeat) {
      player.current?.seek(0);
      player.current?.play();
    } else if (session.tracks.length > 1) {
      selectRelative(1);
    }
  }, [status.state]);
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
            initialVolume={volume}
            onStatus={(next) => {
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
          }} />
        </View>
        <View style={[styles.body, expanded && styles.expandedBody, desktop && styles.desktopBody]}>
          {expanded ? <ScrollView
            style={[styles.trackPane, desktop && styles.desktopTrackPane]}
            contentContainerStyle={[styles.trackList, desktop && styles.desktopTrackList]}
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
              const duration = active ? status.duration : remembered?.duration || 0;
              const imageId = active && status.videoId ? status.videoId : item.videoId;
              const cardTitle = active ? currentTitle || item.title : item.title;
              return <View key={index} style={[styles.track, !wideTransport && styles.trackMobile, active && styles.activeTrack]}>
                <Pressable onPress={() => select(index)} accessibilityRole="button"
                  accessibilityLabel={tr(itemPlaying ? `Pausar ${item.title}` : `Reproducir ${item.title}`)}
                  accessibilityState={{ selected: active }} style={[styles.cardArtworkButton, !wideTransport && styles.cardArtworkButtonMobile]}>
                  {imageId ? <Image source={{ uri: `https://i.ytimg.com/vi/${imageId}/mqdefault.jpg` }}
                    style={[styles.cardArtwork, !wideTransport && styles.cardArtworkMobile]} /> : <View style={[styles.cardArtwork, !wideTransport && styles.cardArtworkMobile, styles.fallback]}>
                    <Ionicons name="albums-outline" size={34} color="#dc2626" />
                  </View>}
                </Pressable>

                <View style={[styles.cardRight, !wideTransport && styles.cardRightMobile]}>
                  <View style={[styles.cardUpperHalf, !wideTransport && styles.cardUpperHalfMobile]}>
                    <View style={styles.cardTextBlock}>
                      <Text style={[styles.cardHeadingTitle, !wideTransport && styles.cardHeadingTitleMobile]} numberOfLines={1}>{cardTitle}</Text>
                      <SyncedLyricLine track={item} uri={active ? lyricsUri : item.lyricsUri || item.lyricsUrl}
                        time={elapsed} compact={!wideTransport} />
                    </View>
                    <View style={[styles.cardTimes, !wideTransport && styles.cardTimesMobile]}>
                      <Text style={[styles.cardCurrentTime, !wideTransport && styles.cardCurrentTimeMobile]}>{formatTime(elapsed)}</Text>
                      <Text style={[styles.cardTotalTime, !wideTransport && styles.cardTotalTimeMobile]}>{duration ? formatTime(duration) : "—:—"}</Text>
                    </View>
                  </View>

                  <View style={[styles.cardProgressRow, !wideTransport && styles.cardProgressRowMobile]}>
                    <Slider
                      style={styles.cardProgressSlider}
                      minimumValue={0}
                      maximumValue={Math.max(duration || 0, 1)}
                      value={Math.min(elapsed || 0, Math.max(duration || 0, 1))}
                      disabled={!active || !status.ready || !duration}
                      onSlidingComplete={(value) => player.current?.seek(value)}
                      minimumTrackTintColor="#ec1970"
                      maximumTrackTintColor="#d7d9dc"
                      thumbTintColor="transparent"
                    />
                  </View>

                  <View style={[styles.cardLowerHalf, !wideTransport && styles.cardLowerHalfMobile]}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Repetir canción"
                      onPress={() => setRepeat((value) => !value)} style={styles.playerOptionButton}>
                      <Ionicons name="repeat" size={22} color={repeat ? "#ec1970" : "#9aa0a6"} />
                    </Pressable>
                    <View style={styles.playbackButtons}>
                      <Pressable accessibilityRole="button" accessibilityLabel="Canción anterior"
                        onPress={() => selectRelative(-1)} style={styles.trackNavButton}>
                        <Ionicons name="play-skip-back" size={25} color="#202124" />
                      </Pressable>
                      <Pressable accessibilityRole="button"
                        accessibilityLabel={tr(itemPlaying ? `Pausar ${item.title}` : `Reproducir ${item.title}`)}
                        disabled={active && (!status.ready || Boolean(status.error))}
                        onPress={() => select(index)} style={[styles.transportPlayButton, !wideTransport && styles.transportPlayButtonMobile, itemPlaying && styles.transportPauseButton]}>
                        <Ionicons name={itemPlaying ? "pause" : "play"} size={wideTransport ? 28 : 19} color="#202124" />
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Canción siguiente"
                        onPress={() => selectRelative(1)} style={styles.trackNavButton}>
                        <Ionicons name="play-skip-forward" size={25} color="#202124" />
                      </Pressable>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Orden aleatorio"
                      onPress={() => setShuffle((value) => !value)} style={styles.playerOptionButton}>
                      <Ionicons name="shuffle" size={22} color={shuffle ? "#ec1970" : "#9aa0a6"} />
                    </Pressable>
                    <Pressable accessibilityRole="link"
                      accessibilityLabel={tr(`Abrir ${cardTitle} en YouTube`)}
                      onPress={() => openTrackExternal(item, active)} style={[styles.youtubeButton, styles.youtubeButtonLower, !wideTransport && styles.youtubeButtonMobile]}>
                      <Ionicons name="logo-youtube" size={wideTransport ? 30 : 22} color="#ff0000" />
                    </Pressable>
                  </View>
                  <View style={[styles.cardAudioSection, !wideTransport && styles.cardAudioSectionMobile]}>
                    <View style={styles.volumeControl}>
                      <Ionicons name={volume === 0 ? "volume-mute" : "volume-medium"} size={18} color="#5f6368" />
                      <Slider style={styles.volumeSlider} minimumValue={0} maximumValue={100} value={volume}
                        onValueChange={(value) => { setVolume(value); player.current?.setVolume(value); }}
                        minimumTrackTintColor="#9aa0a6" maximumTrackTintColor="#d7d9dc" thumbTintColor="#9aa0a6" />
                      <Ionicons name="volume-high" size={18} color="#5f6368" />
                    </View>
                  </View>
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
          {expanded && desktop ? <DesktopLyricsPanel
            track={track}
            uri={lyricsUri}
            time={status.time}
            title={currentTitle || track?.title}
          /> : null}
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
  desktopBody: { flexDirection: "row", width: "100%", maxWidth: 1320, alignSelf: "center", paddingHorizontal: 24, gap: 24 },
  desktopTrackPane: { flex: 1.08, minWidth: 0 },
  desktopLyricsPanel: { flex: 0.92, minWidth: 340, maxWidth: 560, borderLeftWidth: 1, borderLeftColor: "#29292d", paddingLeft: 24, paddingTop: 18, paddingBottom: 18 },
  desktopLyricsHeader: { minHeight: 66, flexDirection: "row", alignItems: "center", paddingBottom: 12 },
  desktopLyricsEyebrow: { fontSize: 9, letterSpacing: 1.2, fontWeight: "900", color: "#ef4444" },
  desktopLyricsTitle: { marginTop: 4, fontSize: 20, lineHeight: 25, fontWeight: "900", color: "#f9fafb" },
  desktopLyricsScroll: { flex: 1, minHeight: 0, ...Platform.select({ web: { scrollbarWidth: "none", msOverflowStyle: "none" } }) },
  desktopLyricsContent: { paddingTop: 24, paddingRight: 20, paddingBottom: 240, gap: 16 },
  desktopLyricLine: { fontSize: 18, lineHeight: 27, fontWeight: "650", color: "#71717a" },
  desktopLyricLineActive: { fontSize: 22, lineHeight: 31, fontWeight: "900", color: "#f9fafb" },
  desktopLyricsEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 30 },
  desktopLyricsEmptyTitle: { marginTop: 6, fontSize: 15, fontWeight: "800", color: "#d4d4d8", textAlign: "center" },
  desktopLyricsEmptyText: { fontSize: 13, lineHeight: 19, color: "#71717a", textAlign: "center" },
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
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      },
    }),
  },
  trackList: { width: "100%", gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 30, ...Platform.select({ web: { touchAction: "pan-y" } }) },
  desktopTrackList: { width: "100%", maxWidth: 788, alignSelf: "center", paddingHorizontal: 0, paddingTop: 18, gap: 10 },
  queueHeader: { width: "100%", minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 3, paddingBottom: 8 },
  queueHeading: { flex: 1, minWidth: 0 },
  queueEyebrow: { fontSize: 9, letterSpacing: 1.2, fontWeight: "900", color: "#ef4444" },
  queueTitle: { marginTop: 3, fontSize: 18, fontWeight: "900", color: "#f9fafb" },
  queueCount: { fontSize: 11, color: "#9ca3af" },
  track: { width: "100%", maxWidth: 788, aspectRatio: 3.152, alignSelf: "center", flexDirection: "row", padding: 0, gap: 0, borderWidth: 1, borderColor: "#d7d9dc", borderRadius: 0, backgroundColor: "#fff", overflow: "hidden", ...Platform.select({ web: { touchAction: "pan-y" } }) },
  cardArtworkButton: { height: "100%", aspectRatio: 1, flexShrink: 0 },
  cardArtwork: { width: "100%", height: "100%", backgroundColor: "#27272a" },
  cardRight: { flex: 1, minWidth: 0, height: "100%", backgroundColor: "#fff" },
  cardUpperHalf: { flex: 1, minHeight: 0, flexDirection: "row", alignItems: "flex-start", paddingTop: 18, paddingLeft: 24, paddingRight: 14 },
  cardTextBlock: { flex: 1, minWidth: 0, justifyContent: "flex-start" },
  cardTimes: { width: 92, flexShrink: 0, alignItems: "flex-end", paddingTop: 1 },
  cardCurrentTime: { fontFamily: CARD_FONT, fontSize: 38, lineHeight: 40, fontWeight: "400", color: "#65696e", fontVariant: ["tabular-nums"] },
  cardTotalTime: { fontFamily: CARD_FONT, marginTop: 1, fontSize: 16, lineHeight: 19, fontWeight: "500", color: "#85898f", fontVariant: ["tabular-nums"] },
  cardProgressRow: { height: 18, justifyContent: "center", backgroundColor: "#fff" },
  cardProgressRowMobile: { height: 10 },
  cardProgressSlider: { width: "100%", height: 22, ...Platform.select({ web: { touchAction: "pan-x" } }) },
  cardLowerHalf: { height: 68, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 10, gap: 5 },
  cardAudioSection: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 14, backgroundColor: "#fff" },
  cardAudioSectionMobile: { height: 28, paddingHorizontal: 7 },
  playerOptionButton: { width: 30, height: 38, alignItems: "center", justifyContent: "center" },
  volumeControl: { flex: 1, minWidth: 68, maxWidth: 130, flexDirection: "row", alignItems: "center", gap: 2 },
  volumeSlider: { flex: 1, height: 28, ...Platform.select({ web: { touchAction: "pan-x" } }) },
  trackMobile: { height: 120 },
  cardArtworkButtonMobile: { width: 120, height: 120 },
  cardArtworkMobile: { width: 120, height: 120 },
  cardRightMobile: { height: 120 },
  cardUpperHalfMobile: { paddingTop: 8, paddingLeft: 10, paddingRight: 5 },
  cardHeadingTitleMobile: { marginRight: 4, fontSize: 14, lineHeight: 17 },
  cardTimesMobile: { width: 56 },
  cardCurrentTimeMobile: { fontSize: 24, lineHeight: 26, fontWeight: "400" },
  cardTotalTimeMobile: { fontSize: 12, lineHeight: 14 },
  youtubeButtonMobile: { width: 28, height: 34, marginLeft: 0 },
  cardLowerHalfMobile: { height: 44, paddingHorizontal: 7, gap: 4 },
  mobileCardHeader: { width: "100%", flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  desktopCardHeader: { height: 112, alignItems: "flex-start", padding: 0 },
  mobileArtworkButton: { width: 82, height: 82, flexShrink: 0 },
  mobileThumbnail: { width: 82, height: 82, borderRadius: 7, backgroundColor: "#27272a" },
  mobileHeadingContent: { flex: 1, minWidth: 0, justifyContent: "center" },
  cardTop: { width: "100%", gap: 10 },
  desktopCardTop: { flexDirection: "row", alignItems: "center" },
  trackMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9, ...Platform.select({ web: { touchAction: "pan-y" } }) },
  activeTrackMain: { flex: 0, width: 118 },
  wideTrackMain: { width: 112, height: 112 },
  trackControls: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingTop: 2 },
  desktopTrackControls: { width: "auto", flexShrink: 0, paddingTop: 0 },
  trackPlayButton: { width: 44, height: 38, borderRadius: 19, borderWidth: 1, borderColor: "#52525b", backgroundColor: "#27272a", alignItems: "center", justifyContent: "center" },
  activePlayButton: { borderColor: "#ef4444", backgroundColor: "#ef4444" },
  activeTransport: { width: "100%", minHeight: 0, gap: 7, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10, borderRadius: 0, backgroundColor: "#fff", justifyContent: "center" },
  sideTransport: { position: "absolute", width: "auto", left: 112, right: 0, top: 40, height: 72, minHeight: 0, paddingHorizontal: 14, paddingTop: 0, paddingBottom: 5, justifyContent: "center" },
  transportTop: { width: "100%", gap: 6, paddingTop: 2 },
  wideTransport: { flexDirection: "row", alignItems: "center", gap: 8 },
  playbackButtons: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, flexShrink: 0 },
  trackNavButton: { width: 34, height: 42, alignItems: "center", justifyContent: "center", ...Platform.select({ web: { touchAction: "pan-y" } }) },
  transportPlayButton: { width: 60, height: 60, borderRadius: 30, borderWidth: 6, borderColor: "#dedede", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", ...Platform.select({ web: { touchAction: "pan-y" } }) },
  transportPlayButtonMobile: { width: 40, height: 40, borderRadius: 20, borderWidth: 4 },
  inactiveTransportPlayButton: { backgroundColor: "#fff" },
  transportPauseButton: { backgroundColor: "#fff", borderColor: "#ec1970" },
  cardHeadingRow: { width: "100%", minHeight: 32, flexDirection: "row", alignItems: "center", gap: 8 },
  cardHeadingTitle: { minWidth: 0, marginRight: 12, fontFamily: CARD_FONT, fontSize: 23, lineHeight: 28, fontWeight: "600", color: "#202124" },
  youtubeButton: { width: 46, height: 38, flexShrink: 0, alignItems: "center", justifyContent: "center", marginLeft: 8, ...Platform.select({ web: { touchAction: "pan-y" } }) },
  youtubeButtonLower: { marginLeft: 2 },
  timelineBlock: { flex: 1, minWidth: 180, gap: 1 },
  timeLabels: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8 },
  transportTitle: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: "700", color: "#73777d", textAlign: "center" },
  progressTime: { width: 43, fontSize: 12, fontWeight: "800", color: "#5f6368", fontVariant: ["tabular-nums"], textAlign: "center" },
  albumVideoRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  activeTrack: { borderColor: "#ec1970", backgroundColor: "#fff" },
  thumbnail: { width: 88, height: 88, borderRadius: 5, backgroundColor: "#27272a" },
  activeThumbnail: { width: 118, height: 118 },
  wideThumbnail: { width: 112, height: 112, borderRadius: 0 },
  fallback: { alignItems: "center", justifyContent: "center" },
  trackText: { flex: 1, minWidth: 0 },
  trackTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800", color: "#f3f4f6" },
  trackTime: { marginTop: 7, fontSize: 12, fontWeight: "700", color: "#d1d5db", fontVariant: ["tabular-nums"] },
  meta: { fontSize: 10, color: "#9ca3af", marginVertical: 3 },
  albumVideos: { gap: 7, paddingTop: 10 },
  cardLyric: { minWidth: 0, minHeight: 28, paddingTop: 3, paddingRight: 10, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#fff" },
  cardLyricSpacer: { width: "100%", height: 38, marginTop: 4 },
  cardLyricText: { flex: 1, minWidth: 0, fontFamily: CARD_FONT, fontSize: 17, lineHeight: 22, fontWeight: "400", color: "#6f7378", textAlign: "left" },
  cardLyricTextMobile: { fontSize: 12, lineHeight: 15 },
  message: { width: "100%", padding: 10, gap: 8 },
  errorActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  error: { color: "#b91c1c", fontSize: 12 },
  retry: { color: "#2563eb", fontWeight: "700", paddingVertical: 5 },
  notice: { fontSize: 12, color: "#9ca3af", padding: 8 },
});
