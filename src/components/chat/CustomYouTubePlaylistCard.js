import React, { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import { usePlayback } from "@/src/components/playback/PlaybackProvider";

export default function CustomYouTubePlaylistCard({ playlist, userName, dateLabel, canDelete, canEdit, deleting, onDelete, onEdit, onExport, isTutorial = false, isNews = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
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
            {(canEdit || canDelete || onExport) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Opciones de ${playlist.title}`}
                accessibilityState={{ expanded: menuOpen }}
                onPress={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }}
                disabled={deleting}
                style={styles.menuButton}
              >
                <Ionicons name="ellipsis-vertical" size={19} color="#475569" />
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
      {menuOpen ? (
        <View style={styles.menu}>
          {canEdit ? (
            <Pressable accessibilityRole="button" style={styles.menuItem} onPress={() => { setMenuOpen(false); onEdit?.(); }}>
              <Ionicons name="create-outline" size={18} color="#334155" />
              <Text style={styles.menuText}>
                {isNews ? "Editar" : isTutorial ? "Editar tutorial" : "Editar lista"}
              </Text>
            </Pressable>
          ) : null}
          {onExport ? (
            <Pressable accessibilityRole="button" style={styles.menuItem} onPress={() => { setMenuOpen(false); onExport(); }}>
              <Ionicons name="share-outline" size={18} color="#334155" />
              <Text style={styles.menuText}>Exportar JSON</Text>
            </Pressable>
          ) : null}
          {canDelete ? (
            <Pressable accessibilityRole="button" disabled={deleting} style={styles.menuItem} onPress={() => { setMenuOpen(false); onDelete?.(); }}>
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
              <Text style={styles.deleteText}>Borrar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  menuButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  menu: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingVertical: 4 },
  menuItem: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  menuText: { fontSize: 14, color: "#334155", fontWeight: "600" },
  deleteText: { fontSize: 14, color: "#dc2626", fontWeight: "600" },
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
