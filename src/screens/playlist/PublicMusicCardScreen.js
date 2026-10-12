import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Vista pública de Shopp. No consulta Convex ni requiere una sesión o IndexedDB.
const videoRe = /^[\w-]{11}$/;
const listRe = /^[\w-]{10,120}$/;
const publicRe = /^[a-z0-9][a-z0-9-]{5,63}$/;

function getUrl(track) {
  if (videoRe.test(track?.videoId || "")) return `https://www.youtube-nocookie.com/embed/${track.videoId}?playsinline=1&rel=0`;
  if (listRe.test(track?.playlistId || "")) return `https://www.youtube-nocookie.com/embed/videoseries?list=${track.playlistId}&playsinline=1`;
  return "";
}
function youtubeLink(track) {
  if (videoRe.test(track?.videoId || "")) return `https://www.youtube.com/watch?v=${track.videoId}`;
  if (listRe.test(track?.playlistId || "")) return `https://www.youtube.com/playlist?list=${track.playlistId}`;
  return "";
}
export default function PublicMusicCardScreen() {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const q = new URLSearchParams(window.location.search);
    const publicId = q.get("p") || "";
    if (publicId) {
      if (!publicRe.test(publicId)) {setError("Código de playlist inválido");setStatus("error");return;}
      fetch(`/music-cards/${encodeURIComponent(publicId)}.json`, { cache: "no-store" })
        .then(r => { if (!r.ok) throw new Error("Playlist no publicada. Comprueba el QR."); return r.json(); })
        .then(d => {
          if (d.schema !== "shopp-public-music-card" || d.version !== 1 || d.id !== publicId || !Array.isArray(d.tracks)) throw new Error("Ficha pública inválida");
          const tracks = d.tracks.filter(t => Boolean(getUrl(t))).slice(0, 100);
          if (!tracks.length) throw new Error("La playlist no contiene vídeos válidos");
          if (active) { setData({title:String(d.title||"Playlist Shopp").slice(0,120),author:String(d.author||"").slice(0,100),tracks});setStatus("ready"); }
        }).catch(e=>{if(active){setError(e.message);setStatus("error");}});
    } else {
      const v=q.get("v")||"",list=q.get("ytpl")||"";
      const track=videoRe.test(v)?{videoId:v}:listRe.test(list)?{playlistId:list}:null;
      if (track) {setData({title:(q.get("t")||"Canción compartida").slice(0,120),author:(q.get("a")||"").slice(0,100),tracks:[track]});setStatus("ready");}
      else {setError("Enlace de canción inválido");setStatus("error");}
    }
    return () => { active = false; };
  }, []);
  const track = data?.tracks[index];
  const src=getUrl(track);
  const openYoutube=()=>{const url=youtubeLink(track);if(url)Linking.openURL(url).catch(()=>{});};
  return <ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.brand}>Shopp · Reproductor público</Text>
    {status === "loading" ? <ActivityIndicator /> : status === "error" ? <Text style={styles.error}>{error}</Text> : <>
      <Text style={styles.title}>{data.title}</Text>
      {data.author ? <Text style={styles.author}>{data.author}</Text> : null}
      <Text style={styles.notice}>Pulsa Reproducir en el vídeo para iniciar el audio.</Text>
      {Platform.OS === "web" && src ? <View style={styles.video}>{React.createElement("iframe",{
        key:src,src,title:"Reproductor de YouTube",allow:"autoplay; encrypted-media; picture-in-picture; fullscreen",allowFullScreen:true,
        referrerPolicy:"strict-origin-when-cross-origin",style:{width:"100%",height:"100%",border:0,backgroundColor:"#0f172a"}
      })}</View> : null}
      {data.tracks.length > 1 ? <View style={styles.list}>{data.tracks.map((item,i)=><Pressable key={`${i}-${item.videoId||item.playlistId}`} onPress={()=>setIndex(i)} style={[styles.track,i===index&&styles.selected]}><Text style={styles.trackText}>{i+1}. {item.title || `Tema ${i+1}`}</Text></Pressable>)}</View> : null}
      <Pressable onPress={openYoutube} style={styles.button}><Text style={styles.buttonText}>Abrir en YouTube</Text></Pressable>
    </>}
    <Pressable onPress={()=>window.location.assign("/")} style={styles.home}><Text style={styles.homeText}>Entrar en Shopp</Text></Pressable>
    <Text style={styles.notice}>Esta ficha es pública y no modifica tus playlists locales.</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({body:{flexGrow:1,alignItems:"center",backgroundColor:"#f1f5f9",padding:20,gap:12},brand:{color:"#2563eb",fontWeight:"800",fontSize:22},title:{fontWeight:"700",fontSize:20,textAlign:"center"},author:{color:"#64748b"},video:{width:"100%",maxWidth:720,aspectRatio:16/9,backgroundColor:"#000"},notice:{fontSize:13,color:"#64748b",textAlign:"center"},list:{width:"100%",maxWidth:720,gap:5},track:{padding:12,backgroundColor:"white",borderRadius:8},selected:{borderWidth:2,borderColor:"#2563eb"},trackText:{fontWeight:"600"},button:{padding:15,backgroundColor:"#dc2626",borderRadius:10,width:"100%",maxWidth:340,alignItems:"center"},buttonText:{color:"white",fontWeight:"700"},home:{padding:12,borderWidth:1,borderColor:"#2563eb",borderRadius:10},homeText:{color:"#2563eb",fontWeight:"700"},error:{color:"#b91c1c",fontWeight:"600"}});
