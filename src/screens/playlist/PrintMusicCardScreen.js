import React, { useMemo, useState } from "react";
import { Image, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";

function youtubeUrl(track) {
  if (!track) return "";
  if (track.url) return String(track.url);
  if (track.playlistId) return `https://www.youtube.com/playlist?list=${track.playlistId}`;
  if (track.videoId) return `https://www.youtube.com/watch?v=${track.videoId}`;
  return "";
}

function qrUrl(value, size = 360) {
  return `https://quickchart.io/qr?size=${size}&margin=1&text=${encodeURIComponent(value)}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export default function PrintMusicCardScreen() {
  const route = useRoute();
  const playlist = route.params?.playlist || {};
  const isClassical = Boolean(route.params?.isClassical);
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const targetUrl = useMemo(() => youtubeUrl(tracks[0]), [tracks]);
  const [title, setTitle] = useState(String(playlist.title || ""));
  const [subtitle, setSubtitle] = useState(
    isClassical
      ? [playlist.composer, playlist.performer].filter(Boolean).join(" · ")
      : `${tracks.length} ${tracks.length === 1 ? "item" : "items"}`,
  );

  const print = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const q = qrUrl(targetUrl, 520);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111}
      .sheet{display:grid;grid-template-columns:90mm 90mm;grid-auto-rows:56mm;gap:6mm;justify-content:center}
      .card{width:90mm;height:56mm;border:.25mm solid #bbb;display:flex;padding:5mm;page-break-inside:avoid;background:#fff}
      .info{flex:1;min-width:0;padding-right:4mm;display:flex;flex-direction:column}.brand{font-size:9pt;color:#2563eb;font-weight:700;margin-bottom:5mm}
      h1{font-size:14pt;line-height:1.15;margin:0 0 2mm;overflow:hidden}p{font-size:9pt;color:#555;margin:0}.hint{margin-top:auto;font-size:8pt;color:#555}
      .qr{width:35mm;height:35mm;align-self:center}.qr img{width:100%;height:100%}
      @media screen{body{background:#eee;padding:10mm}.sheet{background:white;padding:10mm;width:210mm;margin:auto}}
    </style></head><body><div class="sheet"><div class="card"><div class="info"><div class="brand">Shopp</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><div class="hint">Escanea para reproducir</div></div><div class="qr"><img src="${q}" /></div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),350)</script></body></html>`;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  };

  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.heading}>Tarjeta musical</Text>
    <Text style={styles.help}>Previsualiza una tarjeta de 90 × 56 mm. El QR abre la primera canción o playlist de YouTube.</Text>
    <View style={styles.fields}>
      <Text style={styles.label}>Título</Text><TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor="#999" />
      <Text style={styles.label}>Subtítulo</Text><TextInput value={subtitle} onChangeText={setSubtitle} style={styles.input} placeholderTextColor="#999" />
    </View>
    <View style={styles.card}>
      <View style={styles.cardInfo}><Text style={styles.brand}>Shopp</Text><Text style={styles.cardTitle} numberOfLines={3}>{title}</Text><Text style={styles.cardSubtitle}>{subtitle}</Text><Text style={styles.scan}>Escanea para reproducir</Text></View>
      {targetUrl ? <Image source={{ uri: qrUrl(targetUrl) }} style={styles.qr} /> : <View style={[styles.qr, styles.qrEmpty]}><Text>Sin enlace</Text></View>}
    </View>
    <Text style={styles.note}>El QR de esta primera versión apunta directamente a YouTube. Más adelante puede sustituirse por un enlace permanente de Shopp sin cambiar el diseño de la tarjeta.</Text>
    <Pressable disabled={!targetUrl || Platform.OS !== "web"} onPress={print} style={[styles.button, (!targetUrl || Platform.OS !== "web") && styles.disabled]}><Ionicons name="print-outline" size={20} color="#fff"/><Text style={styles.buttonText}>Imprimir / Guardar como PDF</Text></Pressable>
    {Platform.OS !== "web" ? <Text style={styles.note}>La impresión directa está disponible inicialmente en la PWA/web. En iPhone/iPad puedes abrir Shopp en Safari para imprimir o guardar el PDF.</Text> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f8fafc"},content:{padding:20,alignItems:"center",gap:14},heading:{fontSize:26,fontWeight:"700",alignSelf:"stretch"},help:{color:"#64748b",alignSelf:"stretch",maxWidth:720},fields:{width:"100%",maxWidth:720,gap:6},label:{fontWeight:"600",marginTop:4},input:{borderWidth:1,borderColor:"#cbd5e1",borderRadius:8,backgroundColor:"#fff",paddingHorizontal:12,paddingVertical:10,color:"#0f172a"},
  card:{width:340,height:212,backgroundColor:"#fff",borderWidth:1,borderColor:"#cbd5e1",flexDirection:"row",padding:18,shadowColor:"#000",shadowOpacity:.08,shadowRadius:8,elevation:2},cardInfo:{flex:1,paddingRight:12},brand:{fontWeight:"800",color:"#2563eb",fontSize:15,marginBottom:18},cardTitle:{fontSize:20,fontWeight:"700",lineHeight:23},cardSubtitle:{fontSize:13,color:"#64748b",marginTop:7},scan:{fontSize:11,color:"#64748b",marginTop:"auto"},qr:{width:132,height:132,alignSelf:"center"},qrEmpty:{backgroundColor:"#f1f5f9",alignItems:"center",justifyContent:"center"},note:{maxWidth:720,color:"#64748b",fontSize:12,textAlign:"center"},button:{flexDirection:"row",alignItems:"center",gap:8,backgroundColor:"#2563eb",paddingHorizontal:18,paddingVertical:12,borderRadius:9},disabled:{opacity:.45},buttonText:{color:"#fff",fontWeight:"700"}
});
