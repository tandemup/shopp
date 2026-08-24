import React, { useEffect, useRef, useState } from "react";
import { Image, Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

let youtubeApiPromise;
const youtubeTitleCache = new Map();
const COMPACT_CARD_WIDTH = 440;
const COMPACT_CARD_HEIGHT = 90;
const COMPACT_THUMBNAIL_WIDTH = 160;

async function fetchYouTubeTitle(videoId) {
  if (!videoId) return "";
  if (youtubeTitleCache.has(videoId)) return youtubeTitleCache.get(videoId);
  const request = fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`)
    .then((response) => response.ok ? response.json() : null)
    .then((data) => data?.title?.trim() || "")
    .catch(() => "");
  youtubeTitleCache.set(videoId, request);
  return request;
}

function classifyYouTubeContent(playlistId, videoId) {
  if (playlistId?.startsWith("OLAK5uy_")) return "album";
  if (playlistId?.startsWith("RD")) return "mix";
  if (playlistId) return "playlist";
  if (videoId) return "video";
  return "unknown";
}

function getFallbackTitle(contentType, videoTitle) {
  if (contentType === "album") return "Álbum de YouTube";
  if (contentType === "mix") return "Mix de YouTube";
  if (contentType === "playlist") return "Playlist de YouTube";
  if (contentType === "video") return videoTitle || "Vídeo de YouTube";
  return "YouTube";
}

function parseLrc(text) {
  const lines = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const value = rawLine.replace(/\[(?:ar|al|ti|by|offset):[^\]]*\]/gi, "").trim();
    const timestamps = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const lyric = value.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, "").trim();
    if (!lyric) continue;
    for (const match of timestamps) {
      const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
      lines.push({ time: Number(match[1]) * 60 + Number(match[2]) + fraction, text: lyric });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function LyricsPanel({ lines, currentTime }) {
  if (!lines.length) return null;
  let activeIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].time <= currentTime + 0.08) activeIndex = index;
    else break;
  }
  return (
    <View style={styles.lyricsPanel}>
      <Text style={styles.lyricsPrevious} numberOfLines={1}>{activeIndex > 0 ? lines[activeIndex - 1].text : ""}</Text>
      <Text style={styles.lyricsActive} numberOfLines={2}>{activeIndex >= 0 ? lines[activeIndex].text : "♪"}</Text>
      <Text style={styles.lyricsNext} numberOfLines={1}>{activeIndex + 1 < lines.length ? lines[activeIndex + 1].text : ""}</Text>
    </View>
  );
}

function buildEmbedUrl(playlistId, videoId) {
  const path = videoId ? encodeURIComponent(videoId) : "videoseries";
  const params = new URLSearchParams({ enablejsapi: "1", rel: "0" });
  if (playlistId) {
    params.set("listType", "playlist");
    params.set("list", playlistId);
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    params.set("origin", window.location.origin);
  }
  return `https://www.youtube.com/embed/${path}?${params.toString()}`;
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

function PlaylistSelector({ videoIds, activeIndex, onSelect }) {
  if (videoIds.length < 2) return null;
  return (
    <View style={styles.selectorPanel}>
      <Text style={styles.selectorTitle}>Vídeos de la playlist</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorContent}>
        {videoIds.map((id, index) => {
          const active = index === activeIndex;
          return (
            <Pressable key={`${id}-${index}`} onPress={() => onSelect(index)} style={[styles.item, active && styles.itemActive]} accessibilityRole="button" accessibilityLabel={`Reproducir vídeo ${index + 1}`}>
              <Image source={{ uri: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, cache: "force-cache" }} style={styles.thumbnail} resizeMode="cover" />
              <Text style={[styles.itemText, active && styles.itemTextActive]}>Vídeo {index + 1}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function YouTubePlaylistPlayer({ playlistId, videoId, sourceUrl, playlistTitle, thumbnailUrl, lyricsUrl, userName, dateLabel, canDelete, onDelete, deleting, deleteLabel = "Borrar publicación", canEditAlbum, onEditAlbum, editAlbumLabel = "Editar álbum" }) {
  const playerElementRef = useRef(null);
  const playerRef = useRef(null);
  const [videoIds, setVideoIds] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [lyricsLines, setLyricsLines] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setVideoTitle("");
    if (!videoId || playlistId) return undefined;
    fetchYouTubeTitle(videoId).then((title) => {
      if (!cancelled && title) setVideoTitle(title);
    });
    return () => { cancelled = true; };
  }, [playlistId, videoId]);

  useEffect(() => {
    let cancelled = false;
    setLyricsLines([]);
    if (!lyricsUrl) return undefined;
    fetch(lyricsUrl).then((response) => response.ok ? response.text() : "").then((text) => {
      if (!cancelled) setLyricsLines(parseLrc(text));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [lyricsUrl]);

  useEffect(() => {
    let cancelled = false;
    let playlistTimer;
    let playbackTimer;
    setVideoIds([]);
    setActiveIndex(0);
    if (!expanded || (!playlistId && !videoId)) return undefined;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !playerElementRef.current) return;
      const syncPlaylist = (player) => {
        const ids = player.getPlaylist?.() || [];
        if (!cancelled && ids.length) {
          setVideoIds(ids);
          setActiveIndex(Math.max(player.getPlaylistIndex?.() ?? 0, 0));
        }
      };
      playerRef.current = new YT.Player(playerElementRef.current, {
        events: {
          onReady: ({ target }) => {
            syncPlaylist(target);
            playlistTimer = window.setTimeout(() => syncPlaylist(target), 800);
            playbackTimer = window.setInterval(() => {
              if (!cancelled) setCurrentTime(target.getCurrentTime?.() || 0);
            }, 500);
          },
          onStateChange: ({ target }) => syncPlaylist(target),
        },
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(playlistTimer);
      window.clearInterval(playbackTimer);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [expanded, playlistId, videoId]);

  if (!playlistId && !videoId) return null;
  const embedUrl = buildEmbedUrl(playlistId, videoId);
  const contentType = classifyYouTubeContent(playlistId, videoId);
  const displayTitle = playlistTitle?.trim() || getFallbackTitle(contentType, videoTitle);
  const thumbnailVideoId = videoIds[activeIndex] || videoId;
  const displayThumbnail = thumbnailUrl || (thumbnailVideoId ? `https://i.ytimg.com/vi/${thumbnailVideoId}/mqdefault.jpg` : null);
  const selectVideo = (index) => {
    playerRef.current?.playVideoAt?.(index);
    setActiveIndex(index);
  };
  const openDetail = () => {
    document.activeElement?.blur?.();
    setExpanded(true);
  };

  return (
    <View style={styles.card}>
      <View style={styles.compactHeader}>
        <Pressable onPress={openDetail} style={({ pressed }) => [styles.thumbnailButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Abrir reproductor">
          {displayThumbnail ? <Image source={{ uri: displayThumbnail, cache: "force-cache" }} style={styles.compactThumbnail} resizeMode="contain" /> : <View style={styles.thumbnailFallback}><Ionicons name="logo-youtube" size={34} color="#fff" /></View>}
        </Pressable>
        <View style={styles.compactText}>
          {(userName || dateLabel || canEditAlbum || canDelete) && <View style={styles.metaRow}>
            {!!userName && <Text style={styles.userName} numberOfLines={1}>{userName}</Text>}
            <View style={styles.metaSpacer} />
            {!!dateLabel && <Text style={styles.dateLabel} numberOfLines={1}>{dateLabel}</Text>}
            {!!canEditAlbum && <Pressable onPress={onEditAlbum} disabled={deleting} hitSlop={6} style={({ pressed }) => [styles.metaButton, pressed && styles.metaButtonPressed]} accessibilityRole="button" accessibilityLabel={editAlbumLabel}><Ionicons name="pencil-outline" size={13} color="#2563eb" /></Pressable>}
            {!!canDelete && <Pressable onPress={onDelete} disabled={deleting} hitSlop={6} style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed, deleting && styles.deleteButtonDisabled]} accessibilityRole="button" accessibilityLabel={deleteLabel}><Ionicons name="trash-outline" size={13} color="#dc2626" /></Pressable>}
          </View>}
          <Text style={styles.title} numberOfLines={2}>{displayTitle}</Text>
        </View>
      </View>
      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <SafeAreaView style={styles.detailRoot}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle} numberOfLines={1}>{displayTitle}</Text>
            <Pressable onPress={() => setExpanded(false)} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Cerrar reproductor"><Ionicons name="close" size={25} color="#111827" /></Pressable>
          </View>
          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
            <View style={styles.playerFrame}>
              <iframe ref={playerElementRef} title={playlistId ? "Playlist de YouTube" : "Vídeo de YouTube"} src={embedUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{ width: "100%", height: "100%", border: 0, display: "block" }} />
            </View>
            <LyricsPanel lines={lyricsLines} currentTime={currentTime} />
            <PlaylistSelector videoIds={videoIds} activeIndex={activeIndex} onSelect={selectVideo} />
            <View style={styles.footer}>
              <Text style={styles.hint}>{playlistId ? "Selecciona una miniatura para cambiar de vídeo." : "Pulsa reproducir para ver el vídeo."}</Text>
              <Pressable onPress={() => sourceUrl && Linking.openURL(sourceUrl)} disabled={!sourceUrl} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel="Abrir en YouTube"><Text style={styles.openButtonText}>Abrir en YouTube</Text></Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: COMPACT_CARD_WIDTH, maxWidth: "100%", marginTop: 0, overflow: "hidden", borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff" },
  compactHeader: { height: COMPACT_CARD_HEIGHT, flexDirection: "row", alignItems: "stretch" },
  thumbnailButton: { width: COMPACT_THUMBNAIL_WIDTH, height: COMPACT_CARD_HEIGHT, backgroundColor: "#111827" },
  compactThumbnail: { width: COMPACT_THUMBNAIL_WIDTH, height: COMPACT_CARD_HEIGHT, backgroundColor: "#111827" },
  thumbnailFallback: { width: COMPACT_THUMBNAIL_WIDTH, height: COMPACT_CARD_HEIGHT, alignItems: "center", justifyContent: "center", backgroundColor: "#dc2626" },
  compactText: { flex: 1, minWidth: 0, justifyContent: "flex-start", paddingTop: 7, paddingLeft: 10, paddingRight: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  userName: { maxWidth: 110, fontSize: 11, fontWeight: "800", color: "#2563eb" },
  metaSpacer: { flex: 1 },
  dateLabel: { fontSize: 10, color: "#6b7280" },
  metaButton: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  metaButtonPressed: { backgroundColor: "#dbeafe" },
  deleteButton: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  deleteButtonPressed: { backgroundColor: "#fee2e2" },
  deleteButtonDisabled: { opacity: 0.4 },
  detailRoot: { flex: 1, backgroundColor: "#f8fafc" },
  detailHeader: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", backgroundColor: "#fff" },
  detailTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: "#111827" },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  detailScroll: { flex: 1 },
  detailContent: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 12 },
  lyricsPanel: { minHeight: 112, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 12, backgroundColor: "#111827" },
  lyricsPrevious: { minHeight: 18, fontSize: 12, color: "#64748b", textAlign: "center" },
  lyricsActive: { minHeight: 42, marginVertical: 5, fontSize: 18, lineHeight: 23, fontWeight: "800", color: "#fff", textAlign: "center" },
  lyricsNext: { minHeight: 18, fontSize: 12, color: "#94a3b8", textAlign: "center" },
  playerFrame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  selectorPanel: { paddingTop: 9, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  selectorTitle: { paddingHorizontal: 10, fontSize: 12, fontWeight: "800", color: "#374151" },
  selectorContent: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 9, gap: 8 },
  item: { width: 104, overflow: "hidden", borderWidth: 2, borderColor: "transparent", backgroundColor: "#f3f4f6" },
  itemActive: { borderColor: "#dc2626", backgroundColor: "#fee2e2" },
  thumbnail: { width: "100%", height: 58, backgroundColor: "#111827" },
  itemText: { paddingVertical: 5, fontSize: 11, fontWeight: "700", color: "#4b5563", textAlign: "center" },
  itemTextActive: { color: "#b91c1c" },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 9 },
  footerText: { flex: 1 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: "800", color: "#111827" },
  hint: { marginTop: 2, fontSize: 10, lineHeight: 14, color: "#6b7280" },
  openButton: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#dc2626" },
  pressed: { opacity: 0.75 },
  openButtonText: { fontSize: 11, fontWeight: "800", color: "#fff" },
});
