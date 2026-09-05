import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

function getEmbedUrl(track) {
  if (track?.kind === "album" && track.playlistId)
    return `https://www.youtube.com/embed/videoseries?list=${track.playlistId}&rel=0&autoplay=1`;
  return track?.videoId
    ? `https://www.youtube.com/embed/${track.videoId}?rel=0&autoplay=1`
    : "";
}

function parseLrc(text) {
  const lines = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const lyric = rawLine.replace(/\[[^\]]*\]/g, "").trim();
    if (!lyric) continue;
    for (const match of rawLine.matchAll(
      /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g,
    ))
      lines.push({
        time:
          Number(match[1]) * 60 +
          Number(match[2]) +
          (match[3] ? Number(`0.${match[3]}`) : 0),
        text: lyric,
      });
  }
  return lines.sort((a, b) => a.time - b.time);
}

function DraggableTrack({
  track,
  index,
  active,
  dragging,
  onDragStart,
  onDrop,
  onSelect,
}) {
  return (
    <div
      draggable="true"
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", String(index));
        event.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      onDragEnter={(event) => event.preventDefault()}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(index);
      }}
      onDragEnd={() => onDragStart(null)}
      style={{ cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}
    >
      <Pressable
        onPress={() => onSelect(index)}
        style={[
          styles.track,
          active && styles.trackActive,
          dragging && styles.trackDragging,
        ]}
      >
        {track.videoId ? (
          <Image
            source={{
              uri: `https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg`,
            }}
            style={styles.trackImage}
          />
        ) : (
          <View style={styles.trackImageFallback}>
            <Ionicons name="albums" size={24} color="#fff" />
          </View>
        )}
        <View style={styles.trackText}>
          <Text style={styles.trackNumber}>
            {track.kind === "album" ? "Álbum" : "Single"} {index + 1}
          </Text>
          <Text
            style={[styles.trackTitle, active && styles.trackTitleActive]}
            numberOfLines={2}
          >
            {track.title}
          </Text>
          {track.lyricsFileName ? (
            <Text style={styles.trackLyrics} numberOfLines={1}>
              Letras · {track.lyricsFileName}
            </Text>
          ) : null}
        </View>
        <Ionicons name="reorder-three-outline" size={22} color="#64748b" />
        <Ionicons
          name={active ? "volume-high" : "play-circle-outline"}
          size={23}
          color={active ? "#dc2626" : "#64748b"}
        />
      </Pressable>
    </div>
  );
}

function LyricsPanel({ lines, currentTime }) {
  if (!lines.length) return null;
  let active = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].time <= currentTime + 0.08) active = index;
    else break;
  }
  return (
    <View style={styles.lyricsPanel}>
      <Text style={styles.lyricsPrevious} numberOfLines={1}>
        {active > 0 ? lines[active - 1].text : ""}
      </Text>
      <Text style={styles.lyricsActive} numberOfLines={2}>
        {active >= 0 ? lines[active].text : "♪"}
      </Text>
      <Text style={styles.lyricsNext} numberOfLines={1}>
        {active + 1 < lines.length ? lines[active + 1].text : ""}
      </Text>
    </View>
  );
}

let youtubeApiPromise;
function loadYouTubeApi() {
  if (globalThis.YT?.Player) return Promise.resolve(globalThis.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const previous = globalThis.onYouTubeIframeAPIReady;
    globalThis.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(globalThis.YT);
    };
    if (
      !document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      )
    ) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

export default function CustomYouTubePlaylistPlayer({
  playlist,
  userName,
  dateLabel,
  canDelete,
  canEdit,
  deleting,
  onDelete,
  onEdit,
  onReorder,
  isTutorial = false,
}) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const playerHostRef = useRef(null);
  const playerRef = useRef(null);
  const playlistTracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const [tracks, setTracks] = useState(playlistTracks);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [lyricsLines, setLyricsLines] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const activeTrack = tracks[activeIndex] || tracks[0];
  useEffect(() => {
    setTracks(playlistTracks);
  }, [playlist?.tracks]);
  const reorderTracks = (targetIndex) => {
    if (draggingIndex === null || draggingIndex === targetIndex) return;
    const next = [...tracks];
    const [moved] = next.splice(draggingIndex, 1);
    next.splice(targetIndex, 0, moved);
    setTracks(next);
    setDraggingIndex(null);
    setActiveIndex(next.findIndex((track) => track === activeTrack));
    onReorder?.(next);
  };
  useEffect(() => {
    let cancelled = false;
    setLyricsLines([]);
    setCurrentTime(0);
    if (!activeTrack?.lyricsUri) return undefined;
    fetch(activeTrack.lyricsUri)
      .then((response) => (response.ok ? response.text() : ""))
      .then((value) => {
        if (!cancelled) setLyricsLines(parseLrc(value));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeTrack?.lyricsUri]);
  useEffect(() => {
    let cancelled = false;
    let timer;
    const host = playerHostRef.current;
    if (!expanded || !activeTrack || !host) return undefined;
    host.replaceChildren();
    const playerNode = document.createElement("div");
    playerNode.style.width = "100%";
    playerNode.style.height = "100%";
    host.appendChild(playerNode);
    loadYouTubeApi().then((YT) => {
      if (cancelled || !playerNode.isConnected) return;
      const playerVars = { autoplay: 1, rel: 0 };
      if (activeTrack.kind === "album" && activeTrack.playlistId) {
        playerVars.listType = "playlist";
        playerVars.list = activeTrack.playlistId;
      }
      playerRef.current = new YT.Player(playerNode, {
        videoId: activeTrack.videoId || undefined,
        playerVars,
        events: {
          onReady: ({ target }) => {
            timer = window.setInterval(() => {
              if (!cancelled) setCurrentTime(target.getCurrentTime?.() || 0);
            }, 500);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
      if (host.isConnected) host.replaceChildren();
    };
  }, [activeTrack, expanded]);
  if (!activeTrack) return null;
  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded(true)} style={styles.summary}>
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
              <Pressable onPress={onEdit} style={styles.deleteButton}>
                <Ionicons name="create-outline" size={17} color="#475569" />
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable
                onPress={onDelete}
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
      <Modal
        visible={expanded}
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
      >
        <SafeAreaView style={styles.detail}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {playlist.title}
            </Text>
            <Pressable
              onPress={() => setExpanded(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={25} color="#111827" />
            </Pressable>
          </View>
          <View
            style={[styles.detailBody, desktop && styles.detailBodyDesktop]}
          >
            <View
              style={[styles.mediaColumn, desktop && styles.mediaColumnDesktop]}
            >
              <View style={styles.playerFrame}>
                <View ref={playerHostRef} style={styles.playerHost} />
              </View>
              <LyricsPanel lines={lyricsLines} currentTime={currentTime} />
              <Text style={styles.nowPlaying} numberOfLines={2}>
                Reproduciendo: {activeTrack.title}
              </Text>
            </View>
            <ScrollView
              style={[styles.trackPane, desktop && styles.trackPaneDesktop]}
              contentContainerStyle={styles.trackList}
            >
              {tracks.map((track, index) => {
                const active = index === activeIndex;
                return (
                  <DraggableTrack
                    key={`${track.videoId || track.playlistId}-${index}`}
                    track={track}
                    index={index}
                    active={active}
                    dragging={draggingIndex === index}
                    onDragStart={setDraggingIndex}
                    onDrop={reorderTracks}
                    onSelect={setActiveIndex}
                  />
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trackDragging: {
    opacity: 0.55,
    borderColor: "#2563eb",
    borderStyle: "dashed",
  },
  dragInstruction: {
    paddingBottom: 5,
    fontSize: 11,
    fontWeight: "800",
    color: "#2563eb",
  },
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
  detail: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: "#111827" },
  closeButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  detailBody: {
    flex: 1,
    width: "100%",
    maxWidth: 1400,
    alignSelf: "center",
    padding: 10,
  },
  detailBodyDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    padding: 14,
  },
  mediaColumn: { width: "100%" },
  mediaColumnDesktop: { flex: 1.65, minWidth: 0, justifyContent: "flex-start" },
  playerFrame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  playerHost: { width: "100%", height: "100%" },
  nowPlaying: {
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  lyricsPanel: {
    minHeight: 104,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#111827",
  },
  lyricsPrevious: {
    minHeight: 17,
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
  },
  lyricsActive: {
    minHeight: 39,
    marginVertical: 4,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  lyricsNext: {
    minHeight: 17,
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
  },
  trackPane: { flex: 1, minHeight: 0 },
  trackPaneDesktop: {
    flex: 1,
    minWidth: 300,
    borderLeftWidth: 1,
    borderLeftColor: "#e2e8f0",
    paddingLeft: 12,
  },
  trackList: { gap: 7, paddingBottom: 18 },
  track: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 7,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  trackActive: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  trackImage: { width: 92, height: 52, backgroundColor: "#111827" },
  trackImageFallback: {
    width: 92,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
  },
  trackText: { flex: 1, minWidth: 0 },
  trackNumber: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
  },
  trackTitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
  },
  trackTitleActive: { color: "#b91c1c" },
  trackLyrics: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "700",
    color: "#2563eb",
  },
});
