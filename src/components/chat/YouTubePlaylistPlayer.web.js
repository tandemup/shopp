import React, { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { I18nText as Text } from "@/src/i18n";

let youtubeApiPromise;

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
              <Image source={{ uri: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` }} style={styles.thumbnail} resizeMode="cover" />
              <Text style={[styles.itemText, active && styles.itemTextActive]}>Vídeo {index + 1}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function YouTubePlaylistPlayer({ playlistId, videoId, sourceUrl }) {
  const playerElementRef = useRef(null);
  const playerRef = useRef(null);
  const [videoIds, setVideoIds] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let playlistTimer;
    setVideoIds([]);
    setActiveIndex(0);
    if (!playlistId && !videoId) return undefined;

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
          },
          onStateChange: ({ target }) => syncPlaylist(target),
        },
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(playlistTimer);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [playlistId, videoId]);

  if (!playlistId && !videoId) return null;
  const embedUrl = buildEmbedUrl(playlistId, videoId);
  const selectVideo = (index) => {
    playerRef.current?.playVideoAt?.(index);
    setActiveIndex(index);
  };

  return (
    <View style={styles.card}>
      <View style={styles.playerFrame}>
        <iframe
          ref={playerElementRef}
          title={playlistId ? "Playlist de YouTube" : "Vídeo de YouTube"}
          src={embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        />
      </View>
      <PlaylistSelector videoIds={videoIds} activeIndex={activeIndex} onSelect={selectVideo} />
      <View style={styles.footer}>
        <View style={styles.footerText}>
          <Text style={styles.title}>{playlistId ? "Playlist de YouTube" : "Vídeo de YouTube"}</Text>
          <Text style={styles.hint}>{playlistId ? "Selecciona una miniatura para cambiar de vídeo." : "Pulsa reproducir para ver el vídeo dentro del chat."}</Text>
        </View>
        <Pressable onPress={() => Linking.openURL(sourceUrl)} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel="Abrir en YouTube"><Text style={styles.openButtonText}>Abrir</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 420, maxWidth: "100%", marginTop: 7, overflow: "hidden", borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff" },
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
  title: { fontSize: 13, fontWeight: "800", color: "#111827" },
  hint: { marginTop: 2, fontSize: 10, lineHeight: 14, color: "#6b7280" },
  openButton: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#dc2626" },
  pressed: { opacity: 0.75 },
  openButtonText: { fontSize: 11, fontWeight: "800", color: "#fff" },
});
