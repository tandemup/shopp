import React, { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import TutorialInlinePreview, {
  useTutorialInlinePreviewAvailable,
} from "./TutorialInlinePreview";

function trackKindLabel(track) {
  return track?.kind === "album" ? "Serie" : "Vídeo";
}

export default function TutorialCollectionCard({
  playlist,
  userName,
  dateLabel,
  canDelete,
  canEdit,
  deleting,
  onDelete,
  onEdit,
  onExport,
  onOpen,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const canShowPreview = useTutorialInlinePreviewAvailable();
  const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const previewTrack = tracks.find((track) => track?.videoId || track?.playlistId);
  const coverTrack = tracks.find((track) => track?.videoId);
  const visibleTracks = tracks.slice(0, 3);
  const seriesCount = tracks.filter((track) => track?.kind === "album").length;
  const videoCount = Math.max(0, tracks.length - seriesCount);
  const contentSummary = [
    videoCount ? `${videoCount} ${videoCount === 1 ? "vídeo" : "vídeos"}` : null,
    seriesCount ? `${seriesCount} ${seriesCount === 1 ? "serie" : "series"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!tracks.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.hero}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${playlist.title}`}
          style={styles.coverButton}
        >
          {coverTrack?.videoId ? (
            <Image
              source={{
                uri: `https://i.ytimg.com/vi/${coverTrack.videoId}/mqdefault.jpg`,
              }}
              style={styles.cover}
            />
          ) : (
            <View style={styles.coverFallback}>
              <Ionicons name="logo-youtube" size={38} color="#fff" />
            </View>
          )}
          <View style={styles.playOverlay}>
            <Ionicons name="play" size={22} color="#fff" />
          </View>
        </Pressable>

        <View style={styles.heroText}>
          <View style={styles.metaRow}>
            <View style={styles.sourceBadge}>
              <Ionicons name="logo-youtube" size={13} color="#dc2626" />
              <Text style={styles.sourceText}>{userName || "Tutorial"}</Text>
            </View>
            {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
            {canEdit || canDelete || onExport ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Opciones de ${playlist.title}`}
                accessibilityState={{ expanded: menuOpen }}
                onPress={() => setMenuOpen((open) => !open)}
                disabled={deleting}
                style={styles.menuButton}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#475569" />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {playlist.title}
          </Text>
          <Text style={styles.summary}>{contentSummary || "Contenido de YouTube"}</Text>
          <Pressable onPress={onOpen} style={styles.playButton}>
            <Ionicons name="play-circle-outline" size={18} color="#fff" />
            <Text style={styles.playButtonText}>Ver tutorial</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.contents}>
        <Text style={styles.contentsTitle}>CONTENIDO</Text>
        {visibleTracks.map((track, index) => (
          <Pressable
            key={`${track.videoId || track.playlistId || track.url || index}:${index}`}
            onPress={onOpen}
            style={styles.trackRow}
          >
            <View style={styles.trackNumber}>
              <Text style={styles.trackNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.trackText}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {track.title || `${trackKindLabel(track)} ${index + 1}`}
              </Text>
              <Text style={styles.trackType}>{trackKindLabel(track)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#94a3b8" />
          </Pressable>
        ))}
        {tracks.length > visibleTracks.length ? (
          <Text style={styles.moreTracks}>+ {tracks.length - visibleTracks.length} elementos más</Text>
        ) : null}
      </View>

      {canShowPreview && previewTrack ? (
        <View style={styles.previewSection}>
          <Pressable
            onPress={() => setPreviewVisible((visible) => !visible)}
            style={styles.previewButton}
            accessibilityRole="button"
            accessibilityState={{ expanded: previewVisible }}
          >
            <Ionicons
              name={previewVisible ? "eye-off-outline" : "play-outline"}
              size={18}
              color="#1d4ed8"
            />
            <Text style={styles.previewButtonText}>
              {previewVisible ? "Ocultar vista previa" : "Mostrar vista previa"}
            </Text>
          </Pressable>
          <TutorialInlinePreview track={previewTrack} visible={previewVisible} />
        </View>
      ) : null}

      {menuOpen ? (
        <View style={styles.menu}>
          {canEdit ? (
            <Pressable
              accessibilityRole="button"
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onEdit?.();
              }}
            >
              <Ionicons name="create-outline" size={18} color="#334155" />
              <Text style={styles.menuText}>Editar tutorial</Text>
            </Pressable>
          ) : null}
          {onExport ? (
            <Pressable
              accessibilityRole="button"
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onExport();
              }}
            >
              <Ionicons name="share-outline" size={18} color="#334155" />
              <Text style={styles.menuText}>Exportar JSON</Text>
            </Pressable>
          ) : null}
          {canDelete ? (
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onDelete?.();
              }}
            >
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
    width: 680,
    maxWidth: "100%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  hero: { flexDirection: "row", padding: 12, gap: 14 },
  coverButton: {
    width: 164,
    minHeight: 108,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: "#111827",
    justifyContent: "center",
  },
  cover: { width: "100%", height: "100%", minHeight: 108, backgroundColor: "#111827" },
  coverFallback: { flex: 1, minHeight: 108, alignItems: "center", justifyContent: "center", backgroundColor: "#dc2626" },
  playOverlay: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.78)",
  },
  heroText: { flex: 1, minWidth: 0, justifyContent: "center" },
  metaRow: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 8 },
  sourceBadge: { minWidth: 0, flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  sourceText: { color: "#dc2626", fontSize: 11, fontWeight: "800" },
  date: { color: "#64748b", fontSize: 11 },
  menuButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  title: { marginTop: 3, color: "#0f172a", fontSize: 18, lineHeight: 22, fontWeight: "900" },
  summary: { marginTop: 5, color: "#475569", fontSize: 12, fontWeight: "700" },
  playButton: { alignSelf: "flex-start", minHeight: 32, marginTop: 9, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 16, backgroundColor: "#dc2626" },
  playButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  contents: { paddingHorizontal: 14, paddingBottom: 10, borderTopWidth: 1, borderTopColor: "#eef2f7" },
  contentsTitle: { marginTop: 11, marginBottom: 5, color: "#64748b", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  trackRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10 },
  trackNumber: { width: 23, height: 23, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#eff6ff" },
  trackNumberText: { color: "#2563eb", fontSize: 11, fontWeight: "900" },
  trackText: { flex: 1, minWidth: 0 },
  trackTitle: { color: "#1e293b", fontSize: 13, fontWeight: "700" },
  trackType: { marginTop: 1, color: "#64748b", fontSize: 10, fontWeight: "700" },
  moreTracks: { marginLeft: 34, marginTop: 4, color: "#2563eb", fontSize: 11, fontWeight: "800" },
  previewSection: { borderTopWidth: 1, borderTopColor: "#eef2f7" },
  previewButton: { minHeight: 42, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#f8fafc" },
  previewButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "900" },
  menu: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingVertical: 4 },
  menuItem: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  menuText: { fontSize: 14, color: "#334155", fontWeight: "600" },
  deleteText: { fontSize: 14, color: "#dc2626", fontWeight: "600" },
});
