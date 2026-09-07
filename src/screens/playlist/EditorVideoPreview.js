import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import { parseYouTubeUrl } from "@/src/services/urlSafety";
import YouTubeSurface from "@/src/components/playback/YouTubeSurface";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

export default function EditorVideoPreview({ track, active, disabled, onToggle }) {
  const playerRef = useRef(null);
  const [status, setStatus] = useState({});
  const [retry, setRetry] = useState(0);
  const parsed = parseYouTubeUrl(String(track.url || ""));
  const series = track.kind === "album";
  const id = series ? parsed.playlistId : parsed.videoId;
  const valid = parsed.isValid && Boolean(id);
  useEffect(() => { setStatus({}); }, [active, id, retry]);
  const youtubeUrl = series
    ? `https://www.youtube.com/playlist?list=${encodeURIComponent(id || "")}`
    : `https://www.youtube.com/watch?v=${encodeURIComponent(id || "")}`;
  const openYouTube = async () => {
    playerRef.current?.pause();
    try { await Linking.openURL(youtubeUrl); }
    catch { safeAlert("No se pudo abrir YouTube", "Inténtalo de nuevo."); }
  };
  const previewTrack = { kind: series ? "album" : "single", videoId: series ? "" : id, playlistId: series ? id : "" };
  const player = active && valid ? <YouTubeSurface key={`${track.kind}:${id}:${retry}`} ref={playerRef} track={previewTrack}
    onStatus={(value) => setStatus((previous) => ({ ...previous, ...value }))} /> : null;
  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={active ? "Cerrar previsualización" : "Previsualizar"}
          accessibilityState={{ disabled: disabled || !valid, expanded: active && valid }}
          disabled={disabled || !valid} onPress={onToggle}
          style={[styles.button, (disabled || !valid) && styles.disabled]}>
          <Ionicons name={active ? "close-circle-outline" : "play-circle-outline"} size={21} color="#2563eb" />
          <Text style={styles.buttonText}>{active ? "Cerrar previsualización" : series ? "Previsualizar serie" : "Previsualizar vídeo"}</Text>
        </Pressable>
        {active && valid ? <Pressable accessibilityRole="link" onPress={openYouTube} style={styles.button}>
          <Ionicons name="open-outline" size={17} color="#2563eb" />
          <Text style={styles.buttonText}>Abrir en YouTube</Text>
        </Pressable> : null}
      </View>
      {player ? <View style={styles.frame}>{player}</View> : null}
      {active && status.error ? <View><Text style={styles.error}>{status.error}</Text>
        <Pressable onPress={() => { setStatus({}); setRetry((value) => value + 1); }} style={styles.button}>
          <Text style={styles.buttonText}>Reintentar</Text>
        </Pressable></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 9, gap: 9 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { flexDirection: "row", gap: 6, alignItems: "center", minHeight: 38, paddingHorizontal: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },
  buttonText: { fontSize: 12, fontWeight: "700", color: "#2563eb" },
  disabled: { opacity: 0.4 },
  frame: { width: "100%", maxWidth: 560, minHeight: 200, aspectRatio: 16 / 9, alignSelf: "center", backgroundColor: "#000", overflow: "hidden" },
  error: { color: "#b91c1c", fontSize: 12, marginBottom: 8 },
});
