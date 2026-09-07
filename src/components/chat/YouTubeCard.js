import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import { usePlayback } from "@/src/components/playback/PlaybackProvider";

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

export default function YouTubeCard({ playlistId, videoId, sourceUrl, playlistTitle, thumbnailUrl, lyricsUrl, userName, dateLabel, canDelete, onDelete, deleting, deleteLabel = "Borrar publicación", canEditAlbum, onEditAlbum, editAlbumLabel = "Editar álbum" }) {
  const playback = usePlayback();
  const [videoTitle, setVideoTitle] = useState("");
  useEffect(() => {
    let cancelled = false;
    setVideoTitle("");
    if (!videoId || playlistId) return undefined;
    fetchYouTubeTitle(videoId).then((title) => {
      if (!cancelled && title) setVideoTitle(title);
    });
    return () => { cancelled = true; };
  }, [playlistId, videoId]);

  if (!playlistId && !videoId) return null;
  const contentType = classifyYouTubeContent(playlistId, videoId);
  const displayTitle = playlistTitle?.trim() || getFallbackTitle(contentType, videoTitle);
  const displayThumbnail = thumbnailUrl || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null);
  const openDetail = () => playback.open({
    title: displayTitle,
    tracks: [{ kind: playlistId ? "album" : "single", videoId, playlistId, title: displayTitle, lyricsUri: lyricsUrl }],
  });
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
  title: { fontSize: 14, lineHeight: 18, fontWeight: "800", color: "#111827" },
  pressed: { opacity: 0.75 },
});
