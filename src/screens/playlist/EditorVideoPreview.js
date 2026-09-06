import React from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import { parseYouTubeUrl } from "@/src/services/urlSafety";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

export default function EditorVideoPreview({ track, active, disabled, onToggle }) {
  const parsed = parseYouTubeUrl(String(track.url || ""));
  const series = track.kind === "album";
  const id = series ? parsed.playlistId : parsed.videoId;
  const valid = parsed.isValid && Boolean(id);
  const embedUrl = valid
    ? series
      ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(id)}&rel=0&autoplay=1&playsinline=1`
      : `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&autoplay=1&playsinline=1`
    : null;
  const youtubeUrl = series
    ? `https://www.youtube.com/playlist?list=${encodeURIComponent(id || "")}`
    : `https://www.youtube.com/watch?v=${encodeURIComponent(id || "")}`;
  const openYouTube = async () => {
    try { await Linking.openURL(youtubeUrl); }
    catch { safeAlert("No se pudo abrir YouTube", "Inténtalo de nuevo."); }
  };
  let player = null;
  if (active && valid) {
    if (Platform.OS === "web") {
      player = <iframe key={embedUrl} src={embedUrl} title={track.title || "Previsualización de YouTube"}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ display: "block", width: "100%", height: "100%", border: 0 }} />;
    } else {
      // Load WebView only on native platforms. Web uses its own iframe above.
      const { WebView } = require("react-native-webview");
      const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden;background:#000}</style></head><body><iframe src="${embedUrl.replace(/&/g, "&amp;")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
      player = <WebView key={embedUrl} source={{ html, baseUrl: "https://www.youtube.com" }}
        allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
        style={styles.nativePlayer} />;
    }
  }
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 9, gap: 9 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { flexDirection: "row", gap: 6, alignItems: "center", minHeight: 38, paddingHorizontal: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },
  buttonText: { fontSize: 12, fontWeight: "700", color: "#2563eb" },
  disabled: { opacity: 0.4 },
  frame: { width: "100%", maxWidth: 560, aspectRatio: 16 / 9, alignSelf: "center", backgroundColor: "#000", overflow: "hidden" },
  nativePlayer: { flex: 1, backgroundColor: "#000" },
});
