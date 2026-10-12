import React, { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  buildSongCardUrl, buildPlaylistCardUrl, buildPublicManifest, getPublicManifestUrl,
  normalizePublicBase, publicIdForCard, videoIdFromTrack, youtubePlaylistIdFromTrack,
} from "@/src/services/musicCardLinks";

const DEFAULT_CONTACT_EMAIL = "info@ramshopp.com";
const DEFAULT_LANDING_URL = "https://github.com/tandemup/shopp";

function initialLandingUrl() {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location?.origin
  ) {
    return window.location.origin;
  }
  return DEFAULT_LANDING_URL;
}

function qrUrl(value, size = 360) {
  return `https://quickchart.io/qr?size=${size}&margin=1&text=${encodeURIComponent(value)}`;
}

function esc(value) {
  return String(value ?? "").replace(
    /[&<>\"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}


function splitAuthorAndSingle(value) {
  const text = String(value || "").trim();
  if (!text) return { author: "", single: "" };

  // Formatos habituales: "Autor - Single", "Autor – Single" o "Autor — Single".
  const match = text.match(/^(.+?)\s+(?:-|–|—)\s+(.+)$/);
  if (!match) return { author: "", single: text };

  return { author: match[1].trim(), single: match[2].trim() };
}

// Calibración independiente de las dimensiones de las tarjetas.
const DEFAULT_BACK_OFFSET_X_MM = 0;
const DEFAULT_BACK_OFFSET_Y_MM = 0; // Sin desplazamiento adicional por defecto
const MIN_BACK_OFFSET_MM = -3;
const MAX_BACK_OFFSET_MM = 3;
const CALIBRATION_STEP_MM = 0.5;
const DEFAULT_BACK_INSET_MM = 1.5;
const MIN_BACK_INSET_MM = 0;
const MAX_BACK_INSET_MM = 3;

const BACK_PANEL_TONES = [
  { id: "sand", label: "Arena", bg: "#f6f0dd", title: "#1f2937", meta: "#64748b", accent: "#475569" },
  { id: "ice", label: "Azul hielo", bg: "#edf5ff", title: "#1e3a5f", meta: "#5f6f86", accent: "#4f6b8a" },
  { id: "sage", label: "Verde salvia", bg: "#eef5ee", title: "#1f3a2f", meta: "#64746a", accent: "#4e6b5d" },
  { id: "pearl", label: "Perla", bg: "#f7f2f5", title: "#3d2d39", meta: "#786674", accent: "#655664" },
  { id: "mist", label: "Gris niebla", bg: "#f3f4f6", title: "#1f2937", meta: "#6b7280", accent: "#4b5563" },
];
const DEFAULT_BACK_PANEL_TONE = BACK_PANEL_TONES[0].id;

function nextOffset(value, delta) {
  return Math.max(MIN_BACK_OFFSET_MM, Math.min(MAX_BACK_OFFSET_MM,
    Math.round((value + delta) / CALIBRATION_STEP_MM) * CALIBRATION_STEP_MM));
}

function nextBackInset(value, delta) {
  return Math.max(MIN_BACK_INSET_MM, Math.min(MAX_BACK_INSET_MM,
    Math.round((value + delta) / CALIBRATION_STEP_MM) * CALIBRATION_STEP_MM));
}

function getBackPanelTone(toneId) {
  return BACK_PANEL_TONES.find((option) => option.id === toneId) || BACK_PANEL_TONES[0];
}

function buildPrintHtml({
  title,
  author,
  single,
  subtitle,
  cards,
  distinctCards,
  format,
  copies,
  frontCropMarks,
  backCropMarks,
  doubleSided,
  duplexFlip,
  backOffsetX,
  backOffsetY,
  backInsetEnabled,
  backInsetMm,
  backPanelBg,
  backPanelTitleColor,
  backPanelMetaColor,
  backPanelAccentColor,
  coverUri,
  contactEmail,
  landingUrl,
}) {
  const safeTitle = esc(title);
  const safeSubtitle = esc(subtitle);
  const safeEmail = esc(contactEmail);
  const safeLanding = esc(landingUrl);
  const panelBg = esc(backPanelBg || "#f6f0dd");
  const panelTitleColor = esc(backPanelTitleColor || "#1f2937");
  const panelMetaColor = esc(backPanelMetaColor || "#64748b");
  const panelAccentColor = esc(backPanelAccentColor || "#475569");
  const backInset = backInsetEnabled ? Math.max(MIN_BACK_INSET_MM, Math.min(MAX_BACK_INSET_MM, Number(backInsetMm) || 0)) : 0;
  const isCard = format === "card";
  const isDistinct = Boolean(distinctCards);
  const count = isCard ? 1 : isDistinct ? cards.length : Math.max(1, Math.min(99, Number(copies) || 1));
  const perSheet = isCard ? 1 : 10;

  // El reverso se desplaza SOLO con los ajustes X/Y seleccionados en pantalla.
  // Sin compensacion vertical u horizontal adicional.
  // Una página de tamaño A4 completo evita el desbordamiento de Chrome.
  const dx = Number.isFinite(backOffsetX) ? Math.max(MIN_BACK_OFFSET_MM, Math.min(MAX_BACK_OFFSET_MM, backOffsetX)) : 0;
  const dy = Number.isFinite(backOffsetY) ? Math.max(MIN_BACK_OFFSET_MM, Math.min(MAX_BACK_OFFSET_MM, backOffsetY)) : DEFAULT_BACK_OFFSET_Y_MM;
  const frontCutGrid = !isCard && frontCropMarks
    ? `<div class="cut-guides" aria-hidden="true">${[0, 90, 179.9].map(x => `<i class="cut-guide v" style="left:${x}mm"></i>`).join("")}${[0, 56, 112, 168, 224, 279.9].map(y => `<i class="cut-guide h" style="top:${y}mm"></i>`).join("")}</div>`
    : "";
  const backCutGrid = !isCard && backCropMarks
    ? `<div class="cut-guides" aria-hidden="true">${[0, 90, 179.9].map(x => `<i class="cut-guide v" style="left:${x}mm"></i>`).join("")}${[0, 56, 112, 168, 224, 279.9].map(y => `<i class="cut-guide h" style="top:${y}mm"></i>`).join("")}</div>`
    : "";

  // ANVERSO: presentación de Shopp, email y landing page.
  const front = () => `<div class="card-wrap"><div class="card front">
    <div class="shopp-mark">S</div>
    <div class="front-copy">
      <div class="brand">Shopp</div>
      <h1>Tu música, tus listas y tus herramientas</h1>
      <p class="front-text">Descubre Shopp y conoce las funciones de la aplicación.</p>
      ${safeEmail ? `<div class="contact"><span>Email</span><strong>${safeEmail}</strong></div>` : ""}
      ${safeLanding ? `<div class="contact"><span>Web</span><strong>${safeLanding}</strong></div>` : ""}
    </div>
  </div></div>`;

  // REVERSO: cada posición corresponde al mismo tema en ambas caras.
  const back = (entry) => {
    const q = esc(qrUrl(entry.url, 700));
    const cardTitle = esc(entry.title || title);
    const cardAuthor = esc(entry.author || author);
    const cardCover = esc(entry.cover || coverUri);
    return `<div class="card-wrap"><div class="card back" style="padding:${backInset}mm;">
    <div class="back-inner">
      <div class="cover-panel">${cardCover ? `<img class="cover" src="${cardCover}" alt="Carátula"/>` : `<div class="cover placeholder">Shopp Music</div>`}</div>
      <div class="back-info" style="background:${panelBg};">
        <div class="music-meta">${cardAuthor ? `<span class="author" style="color:${panelAccentColor};">${cardAuthor}</span>` : ""}<strong style="color:${panelTitleColor};">${cardTitle}</strong>${safeSubtitle ? `<span class="subtitle" style="color:${panelMetaColor};">${safeSubtitle}</span>` : ""}</div>
        <div class="qr-panel"><img src="${q}" alt="Código QR musical"/><span style="color:${panelAccentColor};">Escanea para escuchar</span></div>
      </div>
    </div>
  </div></div>`;
  };

  const blank = () => `<div class="card-wrap blank"></div>`;
  const pages = [];
  for (let offset = 0; offset < count; offset += perSheet) {
    const slots = Array.from({length: perSheet}, (_, i) =>
      offset + i < count ? cards[isDistinct ? offset + i : 0] : null
    );
    pages.push(`<div class="sheet front-sheet"><div class="cards-grid">${slots.map((entry) => entry ? front() : blank()).join("")}${frontCutGrid}</div></div>`);
    if (doubleSided) {
      const backSlots = Array(perSheet).fill(null);
      slots.forEach((entry, i) => {
        if (!entry) return;
        const row = Math.floor(i / 2);
        const col = i % 2;
        const mapped = isCard ? 0 : duplexFlip === "short" ? (4 - row) * 2 + col : row * 2 + (1 - col);
        backSlots[mapped] = entry;
      });
      pages.push(`<div class="sheet back-sheet"><div class="cards-grid">${backSlots.map((entry) => entry ? back(entry) : blank()).join("")}${backCutGrid}</div></div>`);
    }
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle || "Shopp"}</title><style>
    @page{size:${isCard ? "90mm 56mm" : "A4 portrait"};margin:0}
    *{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    /* Cada hoja ocupa una página física; el desplazamiento no incrementa su altura. */
    .sheet{${isCard ? "position:relative;width:90mm;height:56mm;" : "position:relative;width:209mm;height:295mm;overflow:hidden;"}break-inside:avoid;page-break-inside:avoid}
    .cards-grid{${isCard ? "width:90mm;height:56mm;" : "position:absolute;top:8.5mm;left:15mm;width:180mm;height:280mm;display:grid;grid-template-columns:90mm 90mm;grid-template-rows:repeat(5,56mm);gap:0;"}}
    ${isCard ? "" : `.back-sheet .cards-grid{top:calc(8.5mm + ${dy}mm);left:calc(15mm + ${dx}mm);}`}
    .sheet + .sheet{break-before:page;page-break-before:always}
    .card-wrap{position:relative;width:90mm;height:56mm;break-inside:avoid;page-break-inside:avoid}
    .card{width:90mm;height:56mm;border:0;background:#fff;overflow:hidden}
    /* Una sola línea de 0.10 mm por límite; no modifica el tamaño de las tarjetas. */
    .cut-guides{position:absolute;inset:0;z-index:5;pointer-events:none}
    .cut-guide{display:block;position:absolute;background:#555}
    .cut-guide.v{top:0;width:.10mm;height:280mm}
    .cut-guide.h{left:0;width:180mm;height:.10mm}
    .front{display:flex;align-items:center;padding:7mm;background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)}
    .shopp-mark{width:18mm;height:18mm;border-radius:5mm;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:25pt;font-weight:900;flex:0 0 18mm;margin-right:6mm}
    .front-copy{min-width:0;flex:1}.brand{font-size:15pt;color:#2563eb;font-weight:900;margin-bottom:1.5mm}.front h1{font-size:10.5pt;line-height:1.18;margin:0 0 1.5mm}.front-text{font-size:7.4pt;color:#64748b;margin:0 0 3mm}
    .contact{display:flex;align-items:baseline;gap:2mm;margin-top:1.2mm;min-width:0}.contact span{font-size:6.5pt;text-transform:uppercase;color:#64748b;font-weight:700;min-width:9mm}.contact strong{font-size:7.5pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .back{display:block;background:#fff}.back-inner{width:100%;height:100%;display:flex;overflow:hidden}.cover-panel{flex:1;height:100%;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden}.cover{width:100%;height:100%;display:block;object-fit:contain}.placeholder{display:flex;align-items:center;justify-content:center;background:#e2e8f0;color:#64748b;font-size:18pt;font-weight:700}.back-info{width:31.5%;min-width:0;height:100%;padding:3mm 2.5mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:hidden}
    .music-meta{width:100%;display:flex;flex-direction:column;gap:.8mm;text-align:center;min-width:0}.music-meta strong{font-size:9pt;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.music-meta span{font-size:6.5pt;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.music-meta .author{font-size:7pt;font-weight:700}.music-meta .subtitle{font-size:6pt}
    .qr-panel{width:27mm;padding:1.5mm;border-radius:2mm;background:#fff;display:flex;flex-direction:column;align-items:center;gap:.8mm;box-shadow:0 0 0 .1mm rgba(15,23,42,.06) inset}.qr-panel img{display:block;width:22mm;height:22mm}.qr-panel span{font-size:5.6pt;line-height:1.1;text-align:center;font-weight:700}
    .blank{background:#fff}
    @media screen{body{background:#e5e7eb;padding:${isCard ? "10mm" : "8mm"}}.sheet{background:#fff;margin:0 auto 8mm;${isCard ? "" : "box-shadow:0 2px 12px rgba(0,0,0,.12);"}}}
    @media print{body{background:#fff;padding:0}.sheet{margin:0;box-shadow:none}}
  </style></head><body>${pages.join("")}<script>
    (function(){var imgs=Array.from(document.images);var ready=Promise.all(imgs.map(function(img){return img.complete?Promise.resolve():new Promise(function(r){img.onload=r;img.onerror=r;});}));ready.then(function(){setTimeout(function(){window.print();},200);});})();
  </script></body></html>`;
}
export default function PrintMusicCardScreen() {
  const route = useRoute();
  const playlist = route.params?.playlist || {};
  const isClassical = Boolean(route.params?.isClassical);
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const [cardMode, setCardMode] = useState("songs"); // 10 canciones distintas por hoja
  const [qrDestination, setQrDestination] = useState("landing");
  const [publicBaseUrl, setPublicBaseUrl] = useState(initialLandingUrl);
  const [publicId, setPublicId] = useState(publicIdForCard);
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const validTracks = useMemo(() => tracks.filter(t => videoIdFromTrack(t) || youtubePlaylistIdFromTrack(t)), [tracks]);
  const inferredMusic = useMemo(() => {
    const firstTrack = tracks[0] || {};
    const candidates = [
      playlist.single,
      firstTrack.single,
      firstTrack.title,
      playlist.title,
    ].filter(Boolean);
    const parsed = splitAuthorAndSingle(candidates[0] || "");
    const fallbackParsed = splitAuthorAndSingle(playlist.title || "");

    return {
      author: String(
        playlist.author ||
          playlist.artist ||
          playlist.composer ||
          firstTrack.author ||
          firstTrack.artist ||
          parsed.author ||
          fallbackParsed.author ||
          "",
      ),
      single: String(
        playlist.single ||
          firstTrack.single ||
          parsed.single ||
          fallbackParsed.single ||
          firstTrack.title ||
          playlist.title ||
          "",
      ),
    };
  }, [playlist, tracks]);
  const [title, setTitle] = useState(String(playlist.title || ""));
  const [author, setAuthor] = useState(inferredMusic.author);
  const [single, setSingle] = useState(inferredMusic.single);
  const [subtitle, setSubtitle] = useState(
    isClassical
      ? [playlist.composer, playlist.performer].filter(Boolean).join(" · ")
      : `${tracks.length} ${tracks.length === 1 ? "item" : "items"}`,
  );
  const [printOpen, setPrintOpen] = useState(false);
  const [format, setFormat] = useState("a4");
  const [copies, setCopies] = useState(10);
  const [frontCropMarks, setFrontCropMarks] = useState(false);
  const [backCropMarks, setBackCropMarks] = useState(false);
  const [doubleSided, setDoubleSided] = useState(true);
  const [duplexFlip, setDuplexFlip] = useState("long");
  const [backOffsetX, setBackOffsetX] = useState(DEFAULT_BACK_OFFSET_X_MM);
  const [backOffsetY, setBackOffsetY] = useState(DEFAULT_BACK_OFFSET_Y_MM);
  const [backInsetEnabled, setBackInsetEnabled] = useState(true);
  const [backInsetMm, setBackInsetMm] = useState(DEFAULT_BACK_INSET_MM);
  const [backPanelToneId, setBackPanelToneId] = useState(DEFAULT_BACK_PANEL_TONE);
  const [coverUri, setCoverUri] = useState(
    String(
      playlist.cover ||
        playlist.coverUrl ||
        playlist.image ||
        playlist.thumbnail ||
        "",
    ),
  );
  const [contactEmail, setContactEmail] = useState(DEFAULT_CONTACT_EMAIL);
  const [landingUrl, setLandingUrl] = useState(initialLandingUrl);
  const backPanelTone = useMemo(() => getBackPanelTone(backPanelToneId), [backPanelToneId]);

  const cardEntries = useMemo(() => {
    const origin = normalizePublicBase(publicBaseUrl);
    if (!origin) return [];
    if (cardMode === "playlist") {
      const first = validTracks[0];
      if (!first) return [];
      const url = qrDestination === "youtube"
        ? buildSongCardUrl(origin, first, title, author, "youtube")
        : buildPlaylistCardUrl(origin, publicId, qrDestination);
      return url ? [{ title: title || "Playlist Shopp", author, cover: coverUri, url }] : [];
    }
    const pool = cardMode === "single" ? validTracks.slice(0, 1) : validTracks;
    return pool.slice(0, 99).map((track) => {
      const parsed = splitAuthorAndSingle(track.title || "");
      const trackTitle = cardMode === "single" ? (single || parsed.single) : (parsed.single || track.title);
      const trackAuthor = track.author || track.artist || parsed.author || author;
      const videoId = videoIdFromTrack(track);
      const trackCover = (cardMode === "single" && coverUri) || track.cover || track.coverUrl || track.thumbnail ||
        (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : coverUri);
      const url = buildSongCardUrl(origin, track, trackTitle, trackAuthor, qrDestination);
      return { title: trackTitle, author: trackAuthor, cover: trackCover, url };
    }).filter(x => x.url);
  }, [validTracks, cardMode, qrDestination, publicBaseUrl, publicId, title, author, single, coverUri]);
  const targetUrl = cardEntries[0]?.url || "";

  const downloadPublicManifest = () => {
    if (Platform.OS !== "web") return;
    try {
      const manifest = buildPublicManifest(playlist, publicId, isClassical);
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${publicId}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPublished(false);
      window.alert(`Ficha descargada: ${publicId}.json\nCópiala a public/music-cards/ en el proyecto y despliega Netlify. Después pulsa «Comprobar publicación».`);
    } catch (error) { window.alert(error.message || "No se pudo crear la ficha pública."); }
  };

  const verifyPublicManifest = async () => {
    const url = getPublicManifestUrl(publicBaseUrl, publicId);
    if (!url) { window.alert("Indica una URL pública HTTPS válida."); return; }
    setBusy(true);
    try {
      const response = await fetch(`${url}?check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Ficha no encontrada (HTTP ${response.status}).`);
      const data = await response.json();
      const expected = buildPublicManifest(playlist, publicId, isClassical);
      if (JSON.stringify(data) !== JSON.stringify(expected)) throw new Error("La ficha publicada no coincide con esta playlist. Vuelve a exportarla y desplegarla.");
      setPublished(true);
      window.alert("Ficha pública verificada. Puedes imprimir el QR de la playlist.");
    } catch (error) {setPublished(false);window.alert(error.message || "No se pudo comprobar la publicación.");}
    finally {setBusy(false);}
  };

  const changeCopies = (delta) =>
    setCopies((value) => Math.max(1, Math.min(99, value + delta)));

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
      base64: Platform.OS === "web",
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const uri =
      asset.base64 && asset.mimeType
        ? `data:${asset.mimeType};base64,${asset.base64}`
        : asset.uri;
    setCoverUri(uri);
  };

  const print = () => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !targetUrl) return;
    if (cardMode === "playlist" && qrDestination !== "youtube" && !published) {
      window.alert("Antes de imprimir, exporta la ficha JSON, publícala en Netlify y comprueba su URL.");
      return;
    }
    const html = buildPrintHtml({
      title,
      author,
      single,
      subtitle,
      cards: cardEntries,
      distinctCards: cardMode === "songs",
      format,
      copies,
      frontCropMarks,
  backCropMarks,
      doubleSided,
      duplexFlip,
      backOffsetX,
      backOffsetY,
      backInsetEnabled,
      backInsetMm,
      backPanelBg: backPanelTone.bg,
      backPanelTitleColor: backPanelTone.title,
      backPanelMetaColor: backPanelTone.meta,
      backPanelAccentColor: backPanelTone.accent,
      coverUri,
      contactEmail,
      landingUrl,
    });
    const w = window.open("", "_blank");
    if (!w) {
      window.alert(
        "El navegador ha bloqueado la ventana de impresión. Permite ventanas emergentes para Shopp e inténtalo de nuevo.",
      );
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setPrintOpen(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Tarjeta musical</Text>
        <Text style={styles.help}>
          Tarjeta dúplex de 90 × 56 mm: anverso con información de Shopp y
          reverso con carátula y QR. Puedes configurar el estilo visual del reverso y calibrar su posición en A4 sin variar el tamaño de las tarjetas.
        </Text>
        <View style={styles.fields}>
          <Text style={styles.label}>Contenido de las tarjetas</Text>
          {[["songs", "Canciones distintas (hasta 10 por hoja A4)"], ["single", "Primera canción (copias)"], ["playlist", "Playlist completa (copias)"]].map(([value, label]) => (
            <Pressable key={value} onPress={() => {setCardMode(value);setPublished(false);}} style={styles.optionRow}>
              <Ionicons name={cardMode === value ? "radio-button-on" : "radio-button-off"} color="#2563eb" size={20}/>
              <Text style={styles.optionTitle}>{label}</Text>
            </Pressable>
          ))}
          <Text style={styles.label}>Destino del QR</Text>
          {[["landing", "Página Shopp con YouTube y reproductor público"], ["youtube", "YouTube directamente"], ["shopp", "Reproductor público Shopp directamente"]].map(([value,label])=>(
            <Pressable key={value} onPress={() => setQrDestination(value)} style={styles.optionRow}>
              <Ionicons name={qrDestination === value ? "radio-button-on" : "radio-button-off"} color="#2563eb" size={20}/>
              <Text style={styles.optionTitle}>{label}</Text>
            </Pressable>
          ))}
          <Text style={styles.label}>URL de Shopp publicada (HTTPS, no localhost para imprimir)</Text>
          <TextInput value={publicBaseUrl} onChangeText={(value)=>{setPublicBaseUrl(value);setPublished(false);}} style={styles.input} keyboardType="url" autoCapitalize="none" placeholder="https://mi-shopp.netlify.app" />
          {cardMode === "playlist" && qrDestination !== "youtube" ? <View style={{gap:8,marginTop:8}}>
            <Text style={styles.note}>Esta playlist vive en IndexedDB: para que funcione en otra persona debes descargar su ficha pública y desplegarla en Netlify. No se publican letras LRC ni datos privados.</Text>
            <Pressable style={styles.secondaryButton} onPress={downloadPublicManifest}><Ionicons name="download-outline" color="#2563eb" size={18}/><Text style={styles.secondaryButtonText}>Descargar ficha JSON pública</Text></Pressable>
            <Pressable style={styles.secondaryButton} onPress={verifyPublicManifest} disabled={busy}><Ionicons name="checkmark-circle-outline" color="#2563eb" size={18}/><Text style={styles.secondaryButtonText}>{busy ? "Comprobando..." : "Comprobar publicación"}</Text></Pressable>
            <Text style={styles.note}>{published ? "✓ Ficha publicada y comprobada" : `Ruta: public/music-cards/${publicId}.json`}</Text>
          </View> : null}
          <Text style={styles.note}>En el modo canciones distintas se imprimirán {Math.min(cardEntries.length,99)} tarjetas diferentes; una por pista válida.</Text>
          <Text style={styles.label}>Autor</Text>
          <TextInput
            value={author}
            onChangeText={setAuthor}
            style={styles.input}
            placeholder="Alan Parsons Project"
            placeholderTextColor="#999"
          />
          <Text style={styles.label}>Single</Text>
          <TextInput
            value={single}
            onChangeText={setSingle}
            style={styles.input}
            placeholder="Eye in the Sky"
            placeholderTextColor="#999"
          />
          <Text style={styles.label}>Subtítulo</Text>
          <TextInput
            value={subtitle}
            onChangeText={setSubtitle}
            style={styles.input}
            placeholderTextColor="#999"
          />
          <Text style={styles.label}>Email de contacto (anverso)</Text>
          <TextInput
            value={contactEmail}
            onChangeText={setContactEmail}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="info@ramshopp.com"
            placeholderTextColor="#999"
          />
          <Text style={styles.label}>Landing page de Shopp (anverso)</Text>
          <TextInput
            value={landingUrl}
            onChangeText={setLandingUrl}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://..."
            placeholderTextColor="#999"
          />
          <Text style={styles.label}>Carátula del single (reverso)</Text>
          <View style={styles.coverActions}>
            <Pressable onPress={pickCover} style={styles.secondaryButton}>
              <Ionicons name="image-outline" size={18} color="#2563eb" />
              <Text style={styles.secondaryButtonText}>
                {coverUri ? "Cambiar carátula" : "Seleccionar carátula"}
              </Text>
            </Pressable>
            {coverUri ? (
              <Pressable
                onPress={() => setCoverUri("")}
                style={styles.removeCover}
              >
                <Text style={styles.removeCoverText}>Quitar</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.label}>Estilo del reverso</Text>
          <Pressable style={styles.optionRow} onPress={() => setBackInsetEnabled((v) => !v)}>
            <Ionicons name={backInsetEnabled ? "checkbox" : "square-outline"} size={23} color="#2563eb" />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Margen blanco alrededor del reverso</Text>
              <Text style={styles.optionHelp}>Añade un marco blanco limpio alrededor de la cara trasera.</Text>
            </View>
          </Pressable>
          {backInsetEnabled ? (
            <View style={styles.calibrationRow}>
              <Text style={styles.calibrationLabel}>Margen</Text>
              <Pressable onPress={() => setBackInsetMm((v) => nextBackInset(v, -CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="remove" size={18} color="#0f172a"/></Pressable>
              <Text style={styles.calibrationValue}>{backInsetMm.toFixed(1)} mm</Text>
              <Pressable onPress={() => setBackInsetMm((v) => nextBackInset(v, CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="add" size={18} color="#0f172a"/></Pressable>
            </View>
          ) : null}
          <Text style={styles.label}>Color del panel derecho del reverso</Text>
          <View style={styles.toneGrid}>
            {BACK_PANEL_TONES.map((tone) => (
              <Pressable key={tone.id} onPress={() => setBackPanelToneId(tone.id)} style={[styles.toneChip, backPanelToneId === tone.id && styles.toneChipActive]}>
                <View style={[styles.toneSwatch, { backgroundColor: tone.bg }]} />
                <Text style={styles.toneLabel}>{tone.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>Las líneas de corte se pueden activar por separado para anverso y reverso desde la ventana de impresión; ahora vienen desactivadas por defecto.</Text>
        </View>
        <View style={styles.previewRow}>
          <View>
            <Text style={styles.sideLabel}>ANVERSO</Text>
            <View style={[styles.card, styles.shoppFrontCard]}>
              <View style={styles.shoppLogo}>
                <Text style={styles.shoppLogoText}>S</Text>
              </View>
              <View style={styles.shoppFrontInfo}>
                <Text style={styles.shoppBrand}>Shopp</Text>
                <Text style={styles.shoppTagline}>
                  Tu música, tus listas y tus herramientas
                </Text>
                <Text style={styles.shoppDescription}>
                  Descubre Shopp y conoce las funciones de la aplicación.
                </Text>
                {contactEmail ? (
                  <View style={styles.contactRow}>
                    <Text style={styles.contactLabel}>EMAIL</Text>
                    <Text style={styles.contactValue} numberOfLines={1}>
                      {contactEmail}
                    </Text>
                  </View>
                ) : null}
                {landingUrl ? (
                  <View style={styles.contactRow}>
                    <Text style={styles.contactLabel}>WEB</Text>
                    <Text style={styles.contactValue} numberOfLines={1}>
                      {landingUrl}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          <View>
            <Text style={styles.sideLabel}>REVERSO</Text>
            <View style={[styles.card, styles.musicBackCard, backInsetEnabled && { padding: Math.round(backInsetMm * 6) }]}>
              <View style={styles.backInnerPreview}>
                <View style={styles.coverPanelPreview}>
                  {coverUri ? (
                    <Image
                      source={{ uri: coverUri }}
                      style={styles.coverPreview}
                    />
                  ) : (
                    <View style={[styles.coverPreview, styles.coverEmpty]}>
                      <Ionicons name="disc-outline" size={48} color="#64748b" />
                      <Text style={styles.coverEmptyText}>
                        Selecciona una carátula
                      </Text>
                    </View>
                  )}
                </View>
                <View style={[styles.backInfoPreview, { backgroundColor: backPanelTone.bg }]}>
                  <View style={styles.musicMetaPreview}>
                    {author ? (
                      <Text style={[styles.musicAuthor, { color: backPanelTone.accent }]} numberOfLines={1}>
                        {author}
                      </Text>
                    ) : null}
                    <Text style={[styles.musicTitle, { color: backPanelTone.title }]} numberOfLines={2}>
                      {single || title}
                    </Text>
                    {subtitle ? (
                      <Text style={[styles.musicSubtitle, { color: backPanelTone.meta }]} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {targetUrl ? (
                    <View style={styles.qrPanelPreview}>
                      <Image
                        source={{ uri: qrUrl(targetUrl) }}
                        style={styles.qrBack}
                      />
                      <Text style={[styles.qrHint, { color: backPanelTone.accent }]}>
                        Escanea para escuchar
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.qrPanelPreview, styles.qrEmpty]}>
                      <Text>Sin enlace</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.note}>
          El QR abrirá el destino seleccionado. Para compartir playlists completas
          en otro dispositivo, publica antes su ficha JSON estática en Netlify.
        </Text>
        <Pressable
          disabled={!targetUrl || Platform.OS !== "web" || (cardMode === "playlist" && qrDestination !== "youtube" && !published)}
          onPress={() => setPrintOpen(true)}
          style={[
            styles.button,
            (!targetUrl || Platform.OS !== "web" || (cardMode === "playlist" && qrDestination !== "youtube" && !published)) && styles.disabled,
          ]}
        >
          <Ionicons name="print-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>Imprimir / Guardar como PDF</Text>
        </Pressable>
        {Platform.OS !== "web" ? (
          <Text style={styles.note}>
            La impresión directa está disponible inicialmente en la PWA/web. En
            iPhone/iPad puedes abrir Shopp en Safari para imprimir o guardar el
            PDF.
          </Text>
        ) : null}
      </ScrollView>

      <Modal
        visible={printOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPrintOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Imprimir tarjeta</Text>
            <Text style={styles.modalLabel}>Formato</Text>
            <Pressable
              style={styles.optionRow}
              onPress={() => setFormat("card")}
            >
              <Ionicons
                name={
                  format === "card" ? "radio-button-on" : "radio-button-off"
                }
                size={22}
                color="#2563eb"
              />
              <View>
                <Text style={styles.optionTitle}>Tarjeta 90 × 56 mm</Text>
                <Text style={styles.optionHelp}>
                  Una tarjeta a tamaño físico exacto.
                </Text>
              </View>
            </Pressable>
            <Pressable style={styles.optionRow} onPress={() => setFormat("a4")}>
              <Ionicons
                name={format === "a4" ? "radio-button-on" : "radio-button-off"}
                size={22}
                color="#2563eb"
              />
              <View>
                <Text style={styles.optionTitle}>Hoja A4</Text>
                <Text style={styles.optionHelp}>
                  Distribuye copias para imprimir y recortar.
                </Text>
              </View>
            </Pressable>
            <Text style={styles.modalLabel}>Caras</Text>
            <Pressable
              style={styles.optionRow}
              onPress={() => setDoubleSided((v) => !v)}
            >
              <Ionicons
                name={doubleSided ? "checkbox" : "square-outline"}
                size={23}
                color="#2563eb"
              />
              <View>
                <Text style={styles.optionTitle}>
                  Imprimir anverso y reverso
                </Text>
                <Text style={styles.optionHelp}>
                  Genera primero los anversos de Shopp y después los reversos
                  musicales alineados para dúplex.
                </Text>
              </View>
            </Pressable>

            {format === "a4" ? (
              <>
                <Text style={styles.modalLabel}>{cardMode === "songs" ? "Temas de la lista (una tarjeta por tema)" : "Número de copias"}</Text>
                <View style={styles.counter}>
                  <Pressable
                    disabled={cardMode === "songs"}
                    onPress={() => changeCopies(-1)}
                    style={styles.counterButton}
                  >
                    <Ionicons name="remove" size={20} color="#0f172a" />
                  </Pressable>
                  <Text style={styles.counterValue}>{cardMode === "songs" ? Math.min(cardEntries.length,99) : copies}</Text>
                  <Pressable
                    disabled={cardMode === "songs"}
                    onPress={() => changeCopies(1)}
                    style={styles.counterButton}
                  >
                    <Ionicons name="add" size={20} color="#0f172a" />
                  </Pressable>
                </View>
                <Pressable
                  style={styles.optionRow}
                  onPress={() => setFrontCropMarks((v) => !v)}
                >
                  <Ionicons
                    name={frontCropMarks ? "checkbox" : "square-outline"}
                    size={23}
                    color="#2563eb"
                  />
                  <Text style={styles.optionTitle}>
                    Líneas de corte en el anverso
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.optionRow}
                  onPress={() => setBackCropMarks((v) => !v)}
                >
                  <Ionicons
                    name={backCropMarks ? "checkbox" : "square-outline"}
                    size={23}
                    color="#2563eb"
                  />
                  <Text style={styles.optionTitle}>
                    Líneas de corte en el reverso
                  </Text>
                </Pressable>
                <Text style={styles.optionHelp}>
                  Una sola línea de 0,10 mm entre tarjetas, sin añadir grosor a sus dimensiones. Puedes activarlas por separado en cada cara.
                </Text>
                {doubleSided ? (
                  <>
                    <Text style={styles.modalLabel}>Volteo dúplex</Text>
                    <Pressable
                      style={styles.optionRow}
                      onPress={() => setDuplexFlip("long")}
                    >
                      <Ionicons
                        name={
                          duplexFlip === "long"
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={22}
                        color="#2563eb"
                      />
                      <Text style={styles.optionTitle}>Borde largo</Text>
                    </Pressable>
                    <Pressable
                      style={styles.optionRow}
                      onPress={() => setDuplexFlip("short")}
                    >
                      <Ionicons
                        name={
                          duplexFlip === "short"
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={22}
                        color="#2563eb"
                      />
                      <Text style={styles.optionTitle}>Borde corto</Text>
                    </Pressable>
                    <Text style={styles.modalLabel}>Ajustar posición del reverso (A4)</Text>
                    <Text style={styles.optionHelp}>Ajusta en pasos de 0,5 mm. X 0 e Y 0 significan sin desplazamiento. Solo se mueve el reverso.</Text>
                    <View style={styles.calibrationRow}>
                      <Text style={styles.calibrationLabel}>Horizontal</Text>
                      <Pressable accessibilityLabel="Mover reverso 0,5 mm a la izquierda" onPress={() => setBackOffsetX(v => nextOffset(v, -CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="remove" size={18} color="#0f172a"/></Pressable>
                      <Text style={styles.calibrationValue}>{backOffsetX > 0 ? "+" : ""}{backOffsetX.toFixed(1)} mm</Text>
                      <Pressable accessibilityLabel="Mover reverso 0,5 mm a la derecha" onPress={() => setBackOffsetX(v => nextOffset(v, CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="add" size={18} color="#0f172a"/></Pressable>
                    </View>
                    <View style={styles.calibrationRow}>
                      <Text style={styles.calibrationLabel}>Vertical</Text>
                      <Pressable accessibilityLabel="Subir reverso 0,5 mm" onPress={() => setBackOffsetY(v => nextOffset(v, -CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="remove" size={18} color="#0f172a"/></Pressable>
                      <Text style={styles.calibrationValue}>{backOffsetY > 0 ? "+" : ""}{backOffsetY.toFixed(1)} mm</Text>
                      <Pressable accessibilityLabel="Bajar reverso 0,5 mm" onPress={() => setBackOffsetY(v => nextOffset(v, CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="add" size={18} color="#0f172a"/></Pressable>
                    </View>
                    <Pressable onPress={() => { setBackOffsetX(DEFAULT_BACK_OFFSET_X_MM); setBackOffsetY(DEFAULT_BACK_OFFSET_Y_MM); }} style={styles.resetCalibration}><Text style={styles.resetCalibrationText}>Restablecer ajustes: X 0 mm · Y 0 mm</Text></Pressable>
                  </>
                ) : null}
                <Text style={styles.capacity}>
                  Cabida: 10 tarjetas por página A4 (2 × 5), listas para cortar
                  con tijera.
                </Text>
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setPrintOpen(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={print} style={styles.previewButton}>
                <Ionicons name="print-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Vista previa / Imprimir</Text>
              </Pressable>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, alignItems: "center", gap: 14 },
  heading: { fontSize: 26, fontWeight: "700", alignSelf: "stretch" },
  help: { color: "#64748b", alignSelf: "stretch", maxWidth: 720 },
  fields: { width: "100%", maxWidth: 720, gap: 6 },
  label: { fontWeight: "600", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
  },
  previewRow: {
    width: "100%",
    maxWidth: 760,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    justifyContent: "center",
  },
  sideLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 5,
  },
  shoppFrontCard: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  shoppLogo: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 18,
  },
  shoppLogoText: { color: "#fff", fontSize: 34, fontWeight: "900" },
  shoppFrontInfo: { flex: 1, minWidth: 0 },
  shoppBrand: {
    color: "#2563eb",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  shoppTagline: { color: "#0f172a", fontSize: 15, fontWeight: "700" },
  shoppDescription: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 5,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
    marginTop: 3,
  },
  contactLabel: { fontSize: 9, fontWeight: "800", color: "#64748b", width: 38 },
  contactValue: { fontSize: 11, fontWeight: "600", color: "#0f172a", flex: 1 },
  musicBackCard: { padding: 0, overflow: "hidden", backgroundColor: "#fff" },
  backInnerPreview: { flex: 1, flexDirection: "row", overflow: "hidden" },
  coverPanelPreview: {
    flex: 1,
    height: "100%",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverPreview: { width: "100%", height: "100%", resizeMode: "contain" },
  coverEmpty: {
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  coverEmptyText: { color: "#64748b", fontWeight: "600" },
  backInfoPreview: {
    width: 128,
    height: "100%",
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  musicMetaPreview: { width: "100%", alignItems: "center" },
  musicAuthor: {
    fontWeight: "700",
    fontSize: 10,
    marginBottom: 4,
    textAlign: "center",
  },
  musicTitle: {
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  musicSubtitle: {
    fontSize: 9,
    marginTop: 4,
    textAlign: "center",
  },
  qrPanelPreview: {
    width: 104,
    backgroundColor: "#fff",
    borderRadius: 7,
    padding: 6,
    alignItems: "center",
  },
  qrBack: { width: 76, height: 76 },
  qrHint: {
    fontSize: 7,
    lineHeight: 9,
    textAlign: "center",
    fontWeight: "700",
    color: "#334155",
    marginTop: 3,
  },
  coverActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  secondaryButtonText: { color: "#2563eb", fontWeight: "600" },
  toneGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 8 },
  toneChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff" },
  toneChipActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  toneSwatch: { width: 16, height: 16, borderRadius: 999, borderWidth: 1, borderColor: "rgba(15,23,42,.10)" },
  toneLabel: { color: "#334155", fontSize: 13, fontWeight: "600" },
  removeCover: { paddingHorizontal: 10, paddingVertical: 9 },
  removeCoverText: { color: "#b91c1c", fontWeight: "600" },
  card: {
    width: 340,
    height: 212,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardInfo: { flex: 1, paddingRight: 12 },
  brand: {
    fontWeight: "800",
    color: "#2563eb",
    fontSize: 15,
    marginBottom: 18,
  },
  cardTitle: { fontSize: 20, fontWeight: "700", lineHeight: 23 },
  cardSubtitle: { fontSize: 13, color: "#64748b", marginTop: 7 },
  scan: { fontSize: 11, color: "#64748b", marginTop: "auto" },
  qr: { width: 132, height: 132, alignSelf: "center" },
  qrEmpty: {
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  note: { maxWidth: 720, color: "#64748b", fontSize: 12, textAlign: "center" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 9,
  },
  disabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  modalScrollContent: { padding: 22 },
  calibrationRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 },
  calibrationLabel: { width: 86, color: "#334155", fontWeight: "600" },
  calibrationValue: { minWidth: 74, textAlign: "center", color: "#0f172a", fontWeight: "700" },
  calibrationButton: { width: 36, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9", borderRadius: 6, borderWidth: 1, borderColor: "#cbd5e1" },
  resetCalibration: { paddingVertical: 10, alignItems: "center" },
  resetCalibrationText: { color: "#2563eb", fontSize: 13, fontWeight: "600" },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 18,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginTop: 8,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  optionTitle: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  optionHelp: { fontSize: 12, color: "#64748b", marginTop: 2 },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 5,
  },
  counterButton: {
    width: 42,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  counterValue: {
    minWidth: 52,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  capacity: { fontSize: 12, color: "#64748b", marginTop: 2 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 22,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  cancelText: { fontWeight: "600", color: "#334155" },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },
});
