import React, { useMemo, useState } from "react";
import { Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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

function buildPrintHtml({ title, subtitle, targetUrl, format, copies, cropMarks }) {
  const q = qrUrl(targetUrl, 700);
  const safeTitle = esc(title);
  const safeSubtitle = esc(subtitle);
  const count = format === "card" ? 1 : Math.max(1, Math.min(99, Number(copies) || 1));
  const cards = Array.from({ length: count }, (_, i) => `
    <div class="card-wrap">
      <div class="card">
        <div class="info">
          <div class="brand">Shopp</div>
          <h1>${safeTitle}</h1>
          <p>${safeSubtitle}</p>
          <div class="hint">Escanea para reproducir</div>
        </div>
        <div class="qr"><img src="${q}" alt="QR" /></div>
      </div>
    </div>`).join("");

  const isCard = format === "card";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>
    @page{size:${isCard ? "90mm 56mm" : "A4 portrait"};margin:${isCard ? "0" : "10mm"}}
    *{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{${isCard ? "width:90mm;height:56mm;" : "display:grid;grid-template-columns:90mm 90mm;grid-auto-rows:56mm;column-gap:5mm;row-gap:5mm;justify-content:center;align-content:start;"}}
    .card-wrap{position:relative;width:90mm;height:56mm;break-inside:avoid;page-break-inside:avoid}
    .card{width:90mm;height:56mm;border:.25mm solid #cbd5e1;display:flex;padding:5mm;background:#fff;overflow:hidden}
    .info{flex:1;min-width:0;padding-right:4mm;display:flex;flex-direction:column}.brand{font-size:9pt;color:#2563eb;font-weight:700;margin-bottom:5mm}
    h1{font-size:14pt;line-height:1.15;margin:0 0 2mm;max-height:17mm;overflow:hidden}p{font-size:9pt;line-height:1.2;color:#64748b;margin:0;max-height:9mm;overflow:hidden}.hint{margin-top:auto;font-size:8pt;color:#64748b}
    .qr{width:35mm;height:35mm;align-self:center;flex:0 0 35mm}.qr img{display:block;width:100%;height:100%}
    ${cropMarks && !isCard ? `.card-wrap:before,.card-wrap:after{content:"";position:absolute;pointer-events:none;z-index:2}.card-wrap:before{left:-2mm;right:-2mm;top:0;height:56mm;border-top:.2mm solid #555;border-bottom:.2mm solid #555}.card-wrap:after{top:-2mm;bottom:-2mm;left:0;width:90mm;border-left:.2mm solid #555;border-right:.2mm solid #555}` : ""}
    @media screen{body{background:#e5e7eb;padding:${isCard ? "10mm" : "8mm"}}.sheet{background:#fff;margin:auto;${isCard ? "" : "width:210mm;min-height:297mm;padding:10mm;"}}}
    @media print{.sheet{margin:0}.card-wrap:nth-child(8n+9){break-before:page;page-break-before:always}}
  </style></head><body><div class="sheet">${cards}</div><script>
    (function(){var imgs=Array.from(document.images);var ready=Promise.all(imgs.map(function(img){return img.complete?Promise.resolve():new Promise(function(r){img.onload=r;img.onerror=r;});}));ready.then(function(){setTimeout(function(){window.print();},150);});})();
  </script></body></html>`;
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
  const [printOpen, setPrintOpen] = useState(false);
  const [format, setFormat] = useState("a4");
  const [copies, setCopies] = useState(8);
  const [cropMarks, setCropMarks] = useState(true);

  const changeCopies = (delta) => setCopies((value) => Math.max(1, Math.min(99, value + delta)));

  const print = () => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !targetUrl) return;
    const html = buildPrintHtml({ title, subtitle, targetUrl, format, copies, cropMarks });
    const w = window.open("", "_blank");
    if (!w) {
      window.alert("El navegador ha bloqueado la ventana de impresión. Permite ventanas emergentes para Shopp e inténtalo de nuevo.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setPrintOpen(false);
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
    <Pressable disabled={!targetUrl || Platform.OS !== "web"} onPress={() => setPrintOpen(true)} style={[styles.button, (!targetUrl || Platform.OS !== "web") && styles.disabled]}><Ionicons name="print-outline" size={20} color="#fff"/><Text style={styles.buttonText}>Imprimir / Guardar como PDF</Text></Pressable>
    {Platform.OS !== "web" ? <Text style={styles.note}>La impresión directa está disponible inicialmente en la PWA/web. En iPhone/iPad puedes abrir Shopp en Safari para imprimir o guardar el PDF.</Text> : null}
  </ScrollView>

  <Modal visible={printOpen} transparent animationType="fade" onRequestClose={() => setPrintOpen(false)}>
    <View style={styles.modalBackdrop}><View style={styles.modalCard}>
      <Text style={styles.modalTitle}>Imprimir tarjeta</Text>
      <Text style={styles.modalLabel}>Formato</Text>
      <Pressable style={styles.optionRow} onPress={() => setFormat("card")}><Ionicons name={format === "card" ? "radio-button-on" : "radio-button-off"} size={22} color="#2563eb"/><View><Text style={styles.optionTitle}>Tarjeta 90 × 56 mm</Text><Text style={styles.optionHelp}>Una tarjeta a tamaño físico exacto.</Text></View></Pressable>
      <Pressable style={styles.optionRow} onPress={() => setFormat("a4")}><Ionicons name={format === "a4" ? "radio-button-on" : "radio-button-off"} size={22} color="#2563eb"/><View><Text style={styles.optionTitle}>Hoja A4</Text><Text style={styles.optionHelp}>Distribuye copias para imprimir y recortar.</Text></View></Pressable>

      {format === "a4" ? <>
        <Text style={styles.modalLabel}>Número de copias</Text>
        <View style={styles.counter}><Pressable onPress={() => changeCopies(-1)} style={styles.counterButton}><Ionicons name="remove" size={20} color="#0f172a"/></Pressable><Text style={styles.counterValue}>{copies}</Text><Pressable onPress={() => changeCopies(1)} style={styles.counterButton}><Ionicons name="add" size={20} color="#0f172a"/></Pressable></View>
        <Pressable style={styles.optionRow} onPress={() => setCropMarks((v) => !v)}><Ionicons name={cropMarks ? "checkbox" : "square-outline"} size={23} color="#2563eb"/><Text style={styles.optionTitle}>Mostrar marcas de corte</Text></Pressable>
        <Text style={styles.capacity}>Cabida: hasta 8 tarjetas por página A4.</Text>
      </> : null}

      <View style={styles.modalActions}><Pressable onPress={() => setPrintOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable onPress={print} style={styles.previewButton}><Ionicons name="print-outline" size={18} color="#fff"/><Text style={styles.buttonText}>Vista previa / Imprimir</Text></Pressable></View>
    </View></View>
  </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f8fafc"},content:{padding:20,alignItems:"center",gap:14},heading:{fontSize:26,fontWeight:"700",alignSelf:"stretch"},help:{color:"#64748b",alignSelf:"stretch",maxWidth:720},fields:{width:"100%",maxWidth:720,gap:6},label:{fontWeight:"600",marginTop:4},input:{borderWidth:1,borderColor:"#cbd5e1",borderRadius:8,backgroundColor:"#fff",paddingHorizontal:12,paddingVertical:10,color:"#0f172a"},
  card:{width:340,height:212,backgroundColor:"#fff",borderWidth:1,borderColor:"#cbd5e1",flexDirection:"row",padding:18,shadowColor:"#000",shadowOpacity:.08,shadowRadius:8,elevation:2},cardInfo:{flex:1,paddingRight:12},brand:{fontWeight:"800",color:"#2563eb",fontSize:15,marginBottom:18},cardTitle:{fontSize:20,fontWeight:"700",lineHeight:23},cardSubtitle:{fontSize:13,color:"#64748b",marginTop:7},scan:{fontSize:11,color:"#64748b",marginTop:"auto"},qr:{width:132,height:132,alignSelf:"center"},qrEmpty:{backgroundColor:"#f1f5f9",alignItems:"center",justifyContent:"center"},note:{maxWidth:720,color:"#64748b",fontSize:12,textAlign:"center"},button:{flexDirection:"row",alignItems:"center",gap:8,backgroundColor:"#2563eb",paddingHorizontal:18,paddingVertical:12,borderRadius:9},disabled:{opacity:.45},buttonText:{color:"#fff",fontWeight:"700"},
  modalBackdrop:{flex:1,backgroundColor:"rgba(15,23,42,.42)",alignItems:"center",justifyContent:"center",padding:20},modalCard:{width:"100%",maxWidth:520,backgroundColor:"#fff",borderRadius:14,padding:22,shadowColor:"#000",shadowOpacity:.18,shadowRadius:20,elevation:8},modalTitle:{fontSize:22,fontWeight:"700",color:"#0f172a",marginBottom:18},modalLabel:{fontSize:14,fontWeight:"700",color:"#334155",marginTop:8,marginBottom:8},optionRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:9},optionTitle:{fontSize:15,fontWeight:"600",color:"#0f172a"},optionHelp:{fontSize:12,color:"#64748b",marginTop:2},counter:{flexDirection:"row",alignItems:"center",alignSelf:"flex-start",borderWidth:1,borderColor:"#cbd5e1",borderRadius:8,overflow:"hidden",marginBottom:5},counterButton:{width:42,height:38,alignItems:"center",justifyContent:"center",backgroundColor:"#f8fafc"},counterValue:{minWidth:52,textAlign:"center",fontSize:16,fontWeight:"700",color:"#0f172a"},capacity:{fontSize:12,color:"#64748b",marginTop:2},modalActions:{flexDirection:"row",justifyContent:"flex-end",gap:10,marginTop:22},cancelButton:{paddingHorizontal:16,paddingVertical:11,borderRadius:8,borderWidth:1,borderColor:"#cbd5e1"},cancelText:{fontWeight:"600",color:"#334155"},previewButton:{flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:16,paddingVertical:11,borderRadius:8,backgroundColor:"#2563eb"}
});
