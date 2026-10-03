import React, { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import { usePlayback } from "@/src/components/playback/PlaybackProvider";

// La altura de la card no cambia. La miniatura usa 16:9 exacto para no
// recortar ni deformar el fotograma que devuelve YouTube.
const CARD_WIDTH = 560;
const CARD_HEIGHT = 90;
const VIDEO_THUMBNAIL_WIDTH = (CARD_HEIGHT * 16) / 9;


function splitAuthorAndSingle(value) {
  const text = String(value || "").trim();
  if (!text) return { author: "", single: "" };
  const match = text.match(/^(.+?)\s+(?:-|–|—)\s+(.+)$/);
  return match
    ? { author: match[1].trim(), single: match[2].trim() }
    : { author: "", single: text };
}

export default function CustomYouTubePlaylistCard({ playlist, userName, dateLabel, canDelete, canEdit, deleting, onDelete, onEdit, onExport, onCreateCard, shareable = false, onToggleShareable, isTutorial = false, isNews = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const playback = usePlayback();
  const displayName = String(playlist?.title || "").trim() || userName || "Mi playlist";
  const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const activeTrack = tracks[0];
  const parsedTrack = splitAuthorAndSingle(activeTrack?.title || "");
  const parsedPlaylist = splitAuthorAndSingle(playlist?.title || "");
  const author = String(
    playlist?.author ||
      playlist?.artist ||
      playlist?.composer ||
      activeTrack?.author ||
      activeTrack?.artist ||
      parsedTrack.author ||
      parsedPlaylist.author ||
      "",
  );
  const single = String(
    playlist?.single ||
      activeTrack?.single ||
      parsedTrack.single ||
      parsedPlaylist.single ||
      activeTrack?.title ||
      playlist?.title ||
      "",
  );
  if (!activeTrack) return null;
  return (
    <View style={[styles.card, isNews && styles.newsCard]}>
      <Pressable onPress={() => playback.open(playlist, { isTutorial })} style={styles.summary}>
        {activeTrack.videoId ? (
          <Image
            source={{
              uri: `https://i.ytimg.com/vi/${activeTrack.videoId}/mqdefault.jpg`,
            }}
            style={styles.cover}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons name="albums" size={36} color="#fff" />
          </View>
        )}
        <View style={styles.summaryText}>
          <View style={styles.metaRow}>
            <Text style={styles.user} numberOfLines={1}>
              {displayName}
            </Text>
            {(canEdit || canDelete || onExport || onCreateCard) ? (
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
          {author ? (
            <Text style={styles.author} numberOfLines={1}>
              {author}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={1}>
            {single}
          </Text>
          {onToggleShareable ? (
            <View style={styles.shareRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`Compartir ${displayName}`}
                accessibilityState={{ checked: shareable, disabled: deleting }}
                disabled={deleting}
                onPress={(event) => {
                  event.stopPropagation();
                  onToggleShareable(!shareable);
                }}
                style={styles.shareControl}
              >
                <Ionicons
                  name={shareable ? "checkbox" : "square-outline"}
                  size={19}
                  color={shareable ? "#2563eb" : "#64748b"}
                />
                <Text style={styles.shareLabel}>Compartir</Text>
              </Pressable>
            </View>
          ) : null}
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
          {onCreateCard ? (
            <Pressable accessibilityRole="button" style={styles.menuItem} onPress={() => { setMenuOpen(false); onCreateCard(); }}>
              <Ionicons name="print-outline" size={18} color="#334155" />
              <Text style={styles.menuText}>Crear tarjeta</Text>
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
  newsCard: { width: CARD_WIDTH },
  summary: {
    height: CARD_HEIGHT,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  cover: {
    width: VIDEO_THUMBNAIL_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: "stretch",
    backgroundColor: "#111827",
  },
  coverFallback: {
    width: VIDEO_THUMBNAIL_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 9,
    paddingTop: 2,
    paddingBottom: 5,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  user: { flex: 1, fontSize: 11, fontWeight: "800", color: "#2563eb" },
  shareRow: {
    marginTop: 3,
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  shareControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
    minHeight: 24,
  },
  shareLabel: { fontSize: 12, color: "#334155", fontWeight: "600" },
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
  author: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    color: "#334155",
  },
  title: {
    marginTop: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "400",
    color: "#111827",
  },
});
