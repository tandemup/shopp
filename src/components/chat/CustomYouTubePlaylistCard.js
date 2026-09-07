import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import { usePlayback } from "@/src/components/playback/PlaybackProvider";

export default function CustomYouTubePlaylistCard({ playlist, userName, dateLabel, canDelete, canEdit, deleting, onDelete, onEdit, isTutorial = false }) {
  const playback = usePlayback();
  const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const activeTrack = tracks[0];
  if (!activeTrack) return null;
  return (
    <View style={styles.card}>
      <Pressable onPress={() => playback.open(playlist, { isTutorial })} style={styles.summary}>
        {activeTrack.videoId ? (
          <Image
            source={{
              uri: `https://i.ytimg.com/vi/${activeTrack.videoId}/mqdefault.jpg`,
            }}
            style={styles.cover}
          />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons name="albums" size={36} color="#fff" />
          </View>
        )}
        <View style={styles.summaryText}>
          <View style={styles.metaRow}>
            <Text style={styles.user} numberOfLines={1}>
              {userName}
            </Text>
            <Text style={styles.date}>{dateLabel}</Text>
            {canEdit ? (
              <Pressable onPress={(event) => { event.stopPropagation(); onEdit?.(); }} style={styles.deleteButton}>
                <Ionicons name="create-outline" size={17} color="#475569" />
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable
                onPress={(event) => { event.stopPropagation(); onDelete?.(); }}
                disabled={deleting}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {playlist.title}
          </Text>
          <Text style={styles.count}>
            {tracks.length} elementos{isTutorial ? "" : " · Singles y álbumes"}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 440,
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  summary: {
    minHeight: 90,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  cover: {
    width: 160,
    minHeight: 90,
    alignSelf: "stretch",
    backgroundColor: "#111827",
  },
  coverFallback: {
    width: 160,
    minHeight: 90,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
  },
  summaryText: { flex: 1, minWidth: 0, padding: 9 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  user: { flex: 1, fontSize: 11, fontWeight: "800", color: "#2563eb" },
  date: { fontSize: 10, color: "#64748b" },
  deleteButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: "#111827",
  },
  count: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    color: "#dc2626",
    flexShrink: 1,
  },
});
