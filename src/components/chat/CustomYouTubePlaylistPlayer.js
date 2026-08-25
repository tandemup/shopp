import React, { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

function getEmbedUrl(track) {
  if (track?.kind === "album" && track.playlistId) {
    return `https://www.youtube.com/embed/videoseries?list=${track.playlistId}&rel=0&autoplay=1`;
  }
  return track?.videoId
    ? `https://www.youtube.com/embed/${track.videoId}?rel=0&autoplay=1`
    : "";
}

function parseLrc(text) {
  const lines = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const lyric = rawLine.replace(/\[[^\]]*\]/g, "").trim();
    if (!lyric) continue;
    for (const match of rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)) {
      lines.push({ time: Number(match[1]) * 60 + Number(match[2]) + (match[3] ? Number(`0.${match[3]}`) : 0), text: lyric });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function LyricsPanel({ lines, currentTime }) {
  if (!lines.length) return null;
  let active = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].time <= currentTime + 0.08) active = index;
    else break;
  }
  return <View style={styles.lyricsPanel}><Text style={styles.lyricsPrevious} numberOfLines={1}>{active > 0 ? lines[active - 1].text : ""}</Text><Text style={styles.lyricsActive} numberOfLines={2}>{active >= 0 ? lines[active].text : "♪"}</Text><Text style={styles.lyricsNext} numberOfLines={1}>{active + 1 < lines.length ? lines[active + 1].text : ""}</Text></View>;
}

function buildPlayerHtml(track) {
  const videoId = JSON.stringify(track?.videoId || "");
  const playlistId = JSON.stringify(track?.playlistId || "");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head><body><div id="player"></div><script>var player;var videoId=${videoId};var playlistId=${playlistId};function tick(){if(player&&player.getCurrentTime){window.ReactNativeWebView.postMessage(JSON.stringify({time:player.getCurrentTime()||0}));}}function onYouTubeIframeAPIReady(){var vars={autoplay:1,rel:0};if(playlistId){vars.listType='playlist';vars.list=playlistId;}player=new YT.Player('player',{videoId:videoId||undefined,playerVars:vars,events:{onReady:function(){setInterval(tick,500)}}});}var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);</script></body></html>`;
}

export default function CustomYouTubePlaylistPlayer({ playlist, userName, dateLabel, canDelete, canEdit, deleting, onDelete, onEdit }) {
  const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [lyricsLines, setLyricsLines] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const activeTrack = tracks[activeIndex] || tracks[0];
  const embedUrl = useMemo(
    () => getEmbedUrl(activeTrack),
    [activeTrack],
  );
  const playerHtml = useMemo(() => buildPlayerHtml(activeTrack), [activeTrack]);
  useEffect(() => {
    let cancelled = false;
    setLyricsLines([]);
    setCurrentTime(0);
    if (!activeTrack?.lyricsUri) return undefined;
    fetch(activeTrack.lyricsUri).then((response) => response.ok ? response.text() : "").then((value) => {
      if (!cancelled) setLyricsLines(parseLrc(value));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeTrack?.lyricsUri]);
  if (!activeTrack) return null;
  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded(true)} style={styles.summary}>
        {activeTrack.videoId ? (
          <Image source={{ uri: `https://i.ytimg.com/vi/${activeTrack.videoId}/mqdefault.jpg` }} style={styles.cover} />
        ) : (
          <View style={styles.coverFallback}><Ionicons name="albums" size={36} color="#fff" /></View>
        )}
        <View style={styles.summaryText}>
          <View style={styles.metaRow}>
            <Text style={styles.user} numberOfLines={1}>{userName}</Text>
            <Text style={styles.date}>{dateLabel}</Text>
            {canEdit ? (
              <Pressable onPress={onEdit} style={styles.deleteButton}>
                <Ionicons name="create-outline" size={17} color="#475569" />
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable onPress={onDelete} disabled={deleting} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={2}>{playlist.title}</Text>
          <Text style={styles.count}>{tracks.length} elementos · Singles y álbumes</Text>
        </View>
      </Pressable>
      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <SafeAreaView style={styles.detail}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>{playlist.title}</Text>
            <Pressable onPress={() => setExpanded(false)} style={styles.closeButton}>
              <Ionicons name="close" size={25} color="#111827" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.playerFrame}>
              <WebView key={embedUrl} source={{ html: playerHtml, baseUrl: "https://www.youtube.com" }} allowsFullscreenVideo mediaPlaybackRequiresUserAction={false} onMessage={(event) => { try { setCurrentTime(JSON.parse(event.nativeEvent.data)?.time || 0); } catch {} }} />
            </View>
            <LyricsPanel lines={lyricsLines} currentTime={currentTime} />
            <Text style={styles.nowPlaying}>Reproduciendo: {activeTrack.title}</Text>
            <View style={styles.trackList}>
              {tracks.map((track, index) => {
                const active = index === activeIndex;
                return (
                  <Pressable key={`${track.videoId || track.playlistId}-${index}`} onPress={() => setActiveIndex(index)} style={[styles.track, active && styles.trackActive]}>
                    {track.videoId ? (
                      <Image source={{ uri: `https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg` }} style={styles.trackImage} />
                    ) : (
                      <View style={styles.trackImageFallback}><Ionicons name="albums" size={24} color="#fff" /></View>
                    )}
                    <View style={styles.trackText}>
                      <Text style={styles.trackNumber}>{track.kind === "album" ? "Álbum" : "Single"} {index + 1}</Text>
                      <Text style={[styles.trackTitle, active && styles.trackTitleActive]} numberOfLines={2}>{track.title}</Text>
                      {track.lyricsFileName ? <Text style={styles.trackLyrics} numberOfLines={1}>Letras · {track.lyricsFileName}</Text> : null}
                    </View>
                    <Ionicons name={active ? "volume-high" : "play-circle-outline"} size={23} color={active ? "#dc2626" : "#64748b"} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 440, maxWidth: "100%", borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff" },
  summary: { height: 90, flexDirection: "row" },
  cover: { width: 160, height: 90, backgroundColor: "#111827" },
  coverFallback: { width: 160, height: 90, alignItems: "center", justifyContent: "center", backgroundColor: "#dc2626" },
  summaryText: { flex: 1, minWidth: 0, padding: 9 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  user: { flex: 1, fontSize: 11, fontWeight: "800", color: "#2563eb" },
  date: { fontSize: 10, color: "#64748b" },
  deleteButton: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  title: { marginTop: 4, fontSize: 14, lineHeight: 18, fontWeight: "900", color: "#111827" },
  count: { marginTop: 4, fontSize: 10, fontWeight: "700", color: "#dc2626" },
  detail: { flex: 1, backgroundColor: "#f8fafc" },
  header: { height: 54, flexDirection: "row", alignItems: "center", paddingLeft: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", backgroundColor: "#fff" },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: "#111827" },
  closeButton: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 12 },
  playerFrame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  nowPlaying: { paddingVertical: 10, fontSize: 13, fontWeight: "800", color: "#111827" },
  lyricsPanel: { minHeight: 104, alignItems: "center", justifyContent: "center", padding: 12, backgroundColor: "#111827" },
  lyricsPrevious: { minHeight: 17, fontSize: 11, color: "#64748b", textAlign: "center" },
  lyricsActive: { minHeight: 39, marginVertical: 4, fontSize: 17, lineHeight: 21, fontWeight: "800", color: "#fff", textAlign: "center" },
  lyricsNext: { minHeight: 17, fontSize: 11, color: "#94a3b8", textAlign: "center" },
  trackList: { gap: 7 },
  track: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, padding: 7, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  trackActive: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  trackImage: { width: 92, height: 52, backgroundColor: "#111827" },
  trackImageFallback: { width: 92, height: 52, alignItems: "center", justifyContent: "center", backgroundColor: "#dc2626" },
  trackText: { flex: 1, minWidth: 0 },
  trackNumber: { fontSize: 9, fontWeight: "800", color: "#64748b", textTransform: "uppercase" },
  trackTitle: { marginTop: 2, fontSize: 12, fontWeight: "800", color: "#334155" },
  trackTitleActive: { color: "#b91c1c" },
  trackLyrics: { marginTop: 2, fontSize: 9, fontWeight: "700", color: "#2563eb" },
});
