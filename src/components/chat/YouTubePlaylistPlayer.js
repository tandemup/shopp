import React, { useMemo, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { I18nText as Text } from "@/src/i18n";

function buildPlayerHtml(playlistId, videoId) {
  const path = videoId ? encodeURIComponent(videoId) : "videoseries";
  const listParams = playlistId
    ? `&listType=playlist&list=${encodeURIComponent(playlistId)}`
    : "";
  const embedUrl = `https://www.youtube.com/embed/${path}?enablejsapi=1&rel=0${listParams}`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden;border:0}</style></head><body><iframe id="player" src="${embedUrl}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><script>var player;function send(){if(!player||!player.getPlaylist)return;window.ReactNativeWebView.postMessage(JSON.stringify({type:'playlist',ids:player.getPlaylist()||[],index:Math.max(player.getPlaylistIndex()||0,0)}));}function onYouTubeIframeAPIReady(){player=new YT.Player('player',{events:{onReady:function(){send();setTimeout(send,800)},onStateChange:send}});}window.selectPlaylistItem=function(index){if(player&&player.playVideoAt){player.playVideoAt(index);send();}};var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);</script></body></html>`;
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
            <Pressable key={`${id}-${index}`} onPress={() => onSelect(index)} style={[styles.item, active && styles.itemActive]}>
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
  const webViewRef = useRef(null);
  const [videoIds, setVideoIds] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const html = useMemo(() => buildPlayerHtml(playlistId, videoId), [playlistId, videoId]);
  if (!playlistId && !videoId) return null;

  const selectVideo = (index) => {
    setActiveIndex(index);
    webViewRef.current?.injectJavaScript(`window.selectPlaylistItem(${index});true;`);
  };
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "playlist" && Array.isArray(data.ids)) {
        setVideoIds(data.ids);
        setActiveIndex(data.index || 0);
      }
    } catch {}
  };

  return (
    <View style={styles.card}>
      <View style={styles.playerFrame}><WebView ref={webViewRef} source={{ html, baseUrl: "https://www.youtube.com" }} style={styles.webView} javaScriptEnabled domStorageEnabled allowsFullscreenVideo mediaPlaybackRequiresUserAction onMessage={handleMessage} originWhitelist={["https://*", "about:blank"]} /></View>
      <PlaylistSelector videoIds={videoIds} activeIndex={activeIndex} onSelect={selectVideo} />
      <View style={styles.footer}>
        <View style={styles.footerText}>
          <Text style={styles.title}>{playlistId ? "Playlist de YouTube" : "Vídeo de YouTube"}</Text>
          <Text style={styles.hint}>{playlistId ? "Selecciona una miniatura para cambiar de vídeo." : "Pulsa reproducir para ver el vídeo dentro del chat."}</Text>
        </View>
        <Pressable onPress={() => Linking.openURL(sourceUrl)} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}><Text style={styles.openButtonText}>Abrir</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 360, maxWidth: "100%", marginTop: 7, overflow: "hidden", borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff" },
  playerFrame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  webView: { flex: 1, backgroundColor: "#000" },
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
