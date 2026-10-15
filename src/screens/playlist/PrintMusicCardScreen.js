import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  useWindowDimensions,
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
const DEFAULT_LANDING_URL = "https://ramworks.netlify.app";

function initialLandingUrl() {
  return DEFAULT_LANDING_URL;
}

function qrUrl(value, size = 360) {
  return `https://quickchart.io/qr?size=${size}&margin=1&text=${encodeURIComponent(value)}`;
}

// La leyenda impresa coincide con el destino real configurado para el QR.
// Dos líneas permiten leerla sin reducir el tamaño del propio código QR.
function getQrActionLabel(destination) {
  switch (destination) {
    case "youtube": return "Escuchar en\nYouTube";
    case "shopp": return "Escuchar en\nShopp";
    case "landing":
    default: return "Ver en\nShopp";
  }
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
const DEFAULT_BACK_OFFSET_Y_MM = 2.5; // Calibración vertical inicial del reverso (+2,5 mm)
const MIN_BACK_OFFSET_MM = -3;
const MAX_BACK_OFFSET_MM = 3;
const CALIBRATION_STEP_MM = 0.5;
const DEFAULT_BACK_INSET_MM = 10; // Marco exterior predeterminado de 10 mm en el reverso
const MIN_BACK_INSET_MM = 0;
const MAX_BACK_INSET_MM = 10;

// Estilos independientes de las tres cuadrículas. Las longitudes están en mm.
const GRID_WIDTH_OPTIONS = [0.05, 0.10, 0.12, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50];
const GRID_PATTERN_OPTIONS = [
  { id: "solid", label: "Continua" },
  { id: "dashed", label: "Discontinua" },
  { id: "dotted", label: "Punteada" },
];
const GRID_COLOR_OPTIONS = [
  { label: "Gris oscuro", value: "#555555" },
  { label: "Gris claro", value: "#b4becb" },
  { label: "Negro", value: "#111827" },
  { label: "Azul", value: "#2563eb" },
  { label: "Rojo", value: "#b91c1c" },
  { label: "Verde", value: "#15803d" },
];
const DEFAULT_GRID_STYLES = {
  front: { color: "#555555", width: 0.10, pattern: "solid" },
  back: { color: "#555555", width: 0.10, pattern: "solid" },
  overlay: { color: "#b4becb", width: 0.12, pattern: "dashed" },
};
function safeGridLineStyle(value, fallback) {
  return {
    color: /^#[0-9a-f]{6}$/i.test(value?.color || "") ? value.color : fallback.color,
    width: GRID_WIDTH_OPTIONS.includes(value?.width) ? value.width : fallback.width,
    pattern: GRID_PATTERN_OPTIONS.some(option => option.id === value?.pattern) ? value.pattern : fallback.pattern,
  };
}
// SVG conserva el espesor vectorial en milímetros (CSS border redondea trazos
// inferiores a 1 px en algunos navegadores). El viewBox está expresado en mm.
function makeCutGridSvg(style) {
  const dash = style.pattern === "dashed" ? ' stroke-dasharray="2 1"' :
    style.pattern === "dotted" ? ' stroke-dasharray="0 1" stroke-linecap="round"' : "";
  const gridPath = [
    ...[0, 90, 180].map(x => `M${x} 0V280`),
    ...[0, 56, 112, 168, 224, 280].map(y => `M0 ${y}H180`),
  ].join(" ");
  return `<svg class="grid-vector" xmlns="http://www.w3.org/2000/svg" width="180mm" height="280mm" viewBox="0 0 180 280" aria-hidden="true"><path d="${gridPath}" fill="none" stroke="${style.color}" stroke-width="${style.width}"${dash}/></svg>`;
}
const DEFAULT_COVER_OVERSCAN = 1.08; // Recorte adicional suave para ocultar halos blancos del original

function getCoverOverscan(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_COVER_OVERSCAN;
  }
  const aspect = width / height;
  if (aspect >= 0.95 && aspect <= 1.05) return 1.12;
  if (aspect >= 0.8 && aspect <= 1.25) return 1.10;
  return 1.06;
}

const BACK_PANEL_TONES = [
  { id: "sand", label: "Arena", bg: "#f6f0dd", title: "#1f2937", meta: "#64748b", accent: "#475569" },
  { id: "ice", label: "Azul hielo", bg: "#edf5ff", title: "#1e3a5f", meta: "#5f6f86", accent: "#4f6b8a" },
  { id: "sage", label: "Verde salvia", bg: "#eef5ee", title: "#1f3a2f", meta: "#64746a", accent: "#4e6b5d" },
  { id: "pearl", label: "Perla", bg: "#f7f2f5", title: "#3d2d39", meta: "#786674", accent: "#655664" },
  { id: "mist", label: "Gris niebla", bg: "#f3f4f6", title: "#1f2937", meta: "#6b7280", accent: "#4b5563" },
  { id: "transparent", label: "Transparente", bg: "transparent", title: "#1f2937", meta: "#64748b", accent: "#475569" },
];
const DEFAULT_BACK_PANEL_TONE = BACK_PANEL_TONES[0].id;

// Color independiente del marco del reverso. La carátula se recorta a un
// cuadrado centrado; nunca se estira ni deja bandas laterales.
const BACK_FRAME_TONES = [
  { id: "yellow", label: "Amarillo pálido", bg: "#fff2bd" },
  { id: "white", label: "Blanco", bg: "#ffffff" },
  ...BACK_PANEL_TONES,
];
const DEFAULT_BACK_FRAME_TONE = "yellow";

// El anverso y el panel derecho del reverso tienen colores independientes.
// La opción Original conserva el degradado utilizado hasta ahora al imprimir.
const ORIGINAL_FRONT_BACKGROUND = "linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)";
const FRONT_TONES = [
  { id: "original", label: "Original (degradado)", bg: "#f8fafc", printBackground: ORIGINAL_FRONT_BACKGROUND },
  { id: "white", label: "Blanco", bg: "#ffffff" },
  ...BACK_PANEL_TONES.map(({ id, label, bg }) => ({ id, label, bg })),
];
const DEFAULT_FRONT_TONE = "original";

// Representación del degradado original en la vista previa web, sin dependencias nuevas.
const FRONT_GRADIENT_PREVIEW_URI = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560" preserveAspectRatio="none"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#eff6ff"/></linearGradient></defs><rect width="900" height="560" fill="url(#bg)"/></svg>'
)}`;

// El tablero de ajedrez representa transparencia solo en la muestra del selector.
// No aparece sobre la tarjeta ni se imprime.
const TRANSPARENT_SWATCH_URI = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#ffffff"/><path d="M0 0h12v12H0zM12 12h12v12H12z" fill="#cbd5e1"/></svg>'
)}`;

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

function getBackFrameTone(toneId) {
  return BACK_FRAME_TONES.find((option) => option.id === toneId) || BACK_FRAME_TONES[0];
}

function getFrontTone(toneId) {
  return FRONT_TONES.find((option) => option.id === toneId) || FRONT_TONES[0];
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
  showBackGridOnFront,
  gridStyles,
  qrActionLabel,
  doubleSided,
  duplexFlip,
  backOffsetX,
  backOffsetY,
  backInsetEnabled,
  backInsetMm,
  frontBackground,
  backPanelBg,
  backFrameBg,
  backPanelTitleColor,
  backPanelMetaColor,
  backPanelAccentColor,
  coverUri,
  contactEmail,
  landingUrl,
  coverOverscan = DEFAULT_COVER_OVERSCAN,
}) {
  const safeTitle = esc(title);
  const safeSubtitle = esc(subtitle);
  const safeEmail = esc(contactEmail);
  const safeLanding = esc(landingUrl);
  const frontBg = esc(frontBackground || "linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)");
  const panelBg = esc(backPanelBg ?? "#f6f0dd");
  const frameBg = esc(backFrameBg ?? "#fff2bd");
  const panelTitleColor = esc(backPanelTitleColor || "#1f2937");
  const panelMetaColor = esc(backPanelMetaColor || "#64748b");
  const panelAccentColor = esc(backPanelAccentColor || "#475569");
  const printedQrAction = esc(qrActionLabel || "Ver en\nShopp").replace(/\n/g, "<br>");
  const safeCoverScale = Number.isFinite(coverOverscan) ? Math.max(1, Math.min(1.2, coverOverscan)) : DEFAULT_COVER_OVERSCAN;
  const backInset = backInsetEnabled ? Math.max(MIN_BACK_INSET_MM, Math.min(MAX_BACK_INSET_MM, Number(backInsetMm) || 0)) : 0;
  // Cada tarjeta mide 90 × 56 mm: reservando un cuadrado junto a un panel de 34 mm.
  // El margen se resta a los 4 lados y no cambia el tamaño exterior de la tarjeta.
  const coverSizeMm = 56 - 2 * backInset;
  // Con márgenes grandes, se reserva espacio vertical para autor, título, QR y leyenda.
  const qrSizeMm = Math.max(17.5, 20.5 - Math.max(0, backInset - 4) * 0.5);
  const compactBack = backInset >= 7;
  const frontLineSvg = makeCutGridSvg(safeGridLineStyle(gridStyles?.front, DEFAULT_GRID_STYLES.front));
  const backLineSvg = makeCutGridSvg(safeGridLineStyle(gridStyles?.back, DEFAULT_GRID_STYLES.back));
  const overlayLineSvg = makeCutGridSvg(safeGridLineStyle(gridStyles?.overlay, DEFAULT_GRID_STYLES.overlay));
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
    ? `<div class="cut-guides" aria-hidden="true">${frontLineSvg}</div>`
    : "";
  const backCutGrid = !isCard && backCropMarks
    ? `<div class="cut-guides" aria-hidden="true">${backLineSvg}</div>`
    : "";

  // Proyección de la cuadrícula del REVERSO sobre la cara frontal del papel.
  // En A4, al voltear por el borde largo se refleja X; por el corto se refleja Y.
  // Incluir dx/dy permite ver en el anverso exactamente dónde quedaría el reverso
  // con la calibración seleccionada. No modifica la geometría de ninguna tarjeta.
  const backGridOnFront = !isCard && doubleSided && showBackGridOnFront
    ? (() => {
        const left = duplexFlip === "short" ? 15 + dx : 15 - dx;
        const top = duplexFlip === "short" ? 8.5 - dy : 8.5 + dy;
        return `<div class="reverse-grid-guide" aria-hidden="true" style="left:${left}mm;top:${top}mm;">${overlayLineSvg}</div>`;
      })()
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
    return `<div class="card-wrap"><div class="card back" style="padding:${backInset}mm;background:${frameBg};">
    <div class="back-inner">
      <div class="cover-panel" style="width:${coverSizeMm}mm;flex:0 0 ${coverSizeMm}mm;background:${frameBg};">${cardCover ? `<img class="cover" src="${cardCover}" alt="Carátula" style="transform:scale(${safeCoverScale});"/>` : `<div class="cover placeholder">Shopp Music</div>`}</div>
      <div class="back-info${compactBack ? " compact" : ""}" style="background:${panelBg};">
        <div class="music-meta">${cardAuthor ? `<span class="author" style="color:${panelAccentColor};">${cardAuthor}</span>` : ""}<strong style="color:${panelTitleColor};">${cardTitle}</strong>${safeSubtitle ? `<span class="subtitle" style="color:${panelMetaColor};">${safeSubtitle}</span>` : ""}</div>
        <div class="qr-panel"><img src="${q}" style="width:${qrSizeMm}mm;height:${qrSizeMm}mm;" alt="Código QR musical"/><span style="color:${panelAccentColor};">${printedQrAction}</span></div>
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
    pages.push(`<div class="sheet front-sheet"><div class="cards-grid">${slots.map((entry) => entry ? front() : blank()).join("")}${frontCutGrid}</div>${backGridOnFront}</div>`);
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
    /* Una sola línea por límite, con espesor configurable; la tarjeta conserva su tamaño. */
    .cut-guides{position:absolute;inset:0;z-index:5;pointer-events:none}
    /* Trazado vectorial a escala física: línea centrada exactamente en el corte. */
    .grid-vector{display:block;position:absolute;top:0;left:0;width:180mm;height:280mm;overflow:visible;pointer-events:none}
    /* Guía del reverso proyectada sobre el anverso, con estilo independiente. */
    .reverse-grid-guide{position:absolute;width:180mm;height:280mm;z-index:6;pointer-events:none}
    .front{display:flex;align-items:center;padding:7mm;background:${frontBg}}
    .shopp-mark{width:18mm;height:18mm;border-radius:5mm;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:25pt;font-weight:900;flex:0 0 18mm;margin-right:6mm}
    .front-copy{min-width:0;flex:1}.brand{font-size:15pt;color:#2563eb;font-weight:900;margin-bottom:1.5mm}.front h1{font-size:10.5pt;line-height:1.18;margin:0 0 1.5mm}.front-text{font-size:7.4pt;color:#64748b;margin:0 0 3mm}
    .contact{display:flex;align-items:baseline;gap:2mm;margin-top:1.2mm;min-width:0}.contact span{font-size:6.5pt;text-transform:uppercase;color:#64748b;font-weight:700;min-width:9mm}.contact strong{font-size:7.5pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    /* Cuadrado físico con recorte centrado: misma geometría en pantalla e impresión.
       Los originales cuadrados conservan toda la imagen. No se fuerza la proporción. */
    .back{display:block;background:${frameBg}}.back-inner{width:100%;height:100%;display:flex;overflow:hidden}.cover-panel{min-width:0;height:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden;background:${frameBg}}.cover{width:100%;height:100%;display:block;object-fit:cover;object-position:center}.placeholder{display:flex;align-items:center;justify-content:center;background:#e2e8f0;color:#64748b;font-size:13pt;font-weight:700;text-align:center}.back-info{flex:1;min-width:0;height:100%;padding:1.5mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:.4mm;overflow:hidden}
    .music-meta{width:100%;min-height:0;flex:1 1 auto;display:flex;flex-direction:column;gap:.45mm;text-align:center;min-width:0;overflow:hidden}.music-meta strong{font-size:9pt;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.music-meta span{font-size:6.5pt;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.music-meta .author{font-size:7pt;font-weight:700}.music-meta .subtitle{font-size:6pt}
    /* Con un marco ancho reducimos solo la tipografía musical y el QR, manteniendo
       visibles el QR completo y sus dos líneas inferiores. */
    .back-info.compact{padding:.8mm;gap:.2mm}.back-info.compact .music-meta{gap:.15mm}.back-info.compact .music-meta strong{font-size:7pt;line-height:1.08}.back-info.compact .music-meta .author{font-size:6pt;line-height:1.08}.back-info.compact .music-meta .subtitle{font-size:5pt;line-height:1.08}
    .qr-panel{width:26mm;max-width:100%;flex:0 0 auto;min-height:0;margin-top:auto;padding:.6mm;border-radius:2mm;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.2mm;box-shadow:0 0 0 .1mm rgba(15,23,42,.06) inset}.qr-panel img{display:block;width:20.5mm;height:20.5mm;flex:0 0 auto}.qr-panel span{display:block;width:100%;font-size:5.6pt;line-height:1.1;text-align:center;font-weight:700;flex:0 0 auto;white-space:normal;overflow:visible}.back-info.compact .qr-panel span{font-size:5pt}
    .blank{background:#fff}
    @media screen{body{background:#e5e7eb;padding:${isCard ? "10mm" : "8mm"}}.sheet{background:#fff;margin:0 auto 8mm;${isCard ? "" : "box-shadow:0 2px 12px rgba(0,0,0,.12);"}}}
    @media print{body{background:#fff;padding:0}.sheet{margin:0;box-shadow:none}}
  </style></head><body>${pages.join("")}<script>
    (function(){var imgs=Array.from(document.images);var ready=Promise.all(imgs.map(function(img){return img.complete?Promise.resolve():new Promise(function(r){img.onload=r;img.onerror=r;});}));ready.then(function(){setTimeout(function(){window.print();},200);});})();
  </script></body></html>`;
}
export default function PrintMusicCardScreen() {
  const route = useRoute();
  const { width: viewportWidth } = useWindowDimensions();
  const previewCardWidth = Math.min(340, Math.max(260, viewportWidth - 64));
  const previewCardHeight = previewCardWidth * 56 / 90;
  const playlist = route.params?.playlist || {};
  const isClassical = Boolean(route.params?.isClassical);
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const [cardMode, setCardMode] = useState("songs"); // 10 canciones distintas por hoja
  const [qrDestination, setQrDestination] = useState("landing");
  const [publicBaseUrl, setPublicBaseUrl] = useState(initialLandingUrl);
  const [publicId, setPublicId] = useState(publicIdForCard);
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, type = "info") =>
    setNotice({ title, message: String(message || ""), type });
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
  const [showBackGridOnFront, setShowBackGridOnFront] = useState(false);
  const [gridStyles, setGridStyles] = useState(() => ({
    front: { ...DEFAULT_GRID_STYLES.front },
    back: { ...DEFAULT_GRID_STYLES.back },
    overlay: { ...DEFAULT_GRID_STYLES.overlay },
  }));
  const updateGridStyle = (side, property, value) => setGridStyles(previous => ({
    ...previous,
    [side]: { ...previous[side], [property]: value },
  }));
  const changeGridWidth = (side, step) => setGridStyles(previous => {
    const current = previous[side].width;
    const index = GRID_WIDTH_OPTIONS.indexOf(current);
    const next = GRID_WIDTH_OPTIONS[Math.max(0, Math.min(GRID_WIDTH_OPTIONS.length - 1, (index >= 0 ? index : 1) + step))];
    return { ...previous, [side]: { ...previous[side], width: next } };
  });
  const [doubleSided, setDoubleSided] = useState(true);
  const [duplexFlip, setDuplexFlip] = useState("long");
  const [backOffsetX, setBackOffsetX] = useState(DEFAULT_BACK_OFFSET_X_MM);
  const [backOffsetY, setBackOffsetY] = useState(DEFAULT_BACK_OFFSET_Y_MM);
  const [backInsetEnabled, setBackInsetEnabled] = useState(true);
  const [backInsetMm, setBackInsetMm] = useState(DEFAULT_BACK_INSET_MM);
  const [backPanelToneId, setBackPanelToneId] = useState(DEFAULT_BACK_PANEL_TONE);
  const [backFrameToneId, setBackFrameToneId] = useState(DEFAULT_BACK_FRAME_TONE);
  const [frontToneId, setFrontToneId] = useState(DEFAULT_FRONT_TONE);
  const previewInsetPx = backInsetEnabled ? backInsetMm * previewCardWidth / 90 : 0;
  // Un cuadrado de 56 - 2*margen mm en una tarjeta de 90 x 56 mm.
  // Base fija en el eje horizontal: flex: 0 (sin base) colapsaba la carátula en web.
  const previewCoverSizePx = Math.max(0, previewCardHeight - 2 - 2 * previewInsetPx);
  const previewQrSizePx = Math.max(17.5, 20.5 - Math.max(0, (backInsetEnabled ? backInsetMm : 0) - 4) * 0.5) * previewCardWidth / 90;
  const previewCompactBack = backInsetEnabled && backInsetMm >= 7;
  const [coverUri, setCoverUri] = useState(
    String(
      playlist.cover ||
        playlist.coverUrl ||
        playlist.image ||
        playlist.thumbnail ||
        "",
    ),
  );
  // Dimensiones reales (px) del archivo seleccionado; independientes de su
  // presentación cuadrada en la tarjeta impresa.
  const [coverDimensions, setCoverDimensions] = useState(null);
  useEffect(() => {
    if (!coverUri) {
      setCoverDimensions(null);
      return;
    }
    // ImagePicker ya proporciona las dimensiones, sin esperar otra descarga.
    if (coverDimensions?.uri === coverUri) return;

    let canceled = false;
    Image.getSize(
      coverUri,
      (width, height) => {
        if (!canceled) setCoverDimensions({ uri: coverUri, width, height });
      },
      () => {
        if (!canceled) setCoverDimensions({ uri: coverUri, width: null, height: null });
      },
    );
    return () => { canceled = true; };
  }, [coverUri, coverDimensions?.uri]);
  const coverSizeLabel = !coverUri
    ? "Sin imagen seleccionada"
    : coverDimensions?.uri !== coverUri
      ? "Leyendo dimensiones…"
      : Number.isFinite(coverDimensions.width) && Number.isFinite(coverDimensions.height)
        ? `${coverDimensions.width} × ${coverDimensions.height} px`
        : "Dimensiones no disponibles";
  const coverRenderScale = useMemo(() => getCoverOverscan(coverDimensions?.width, coverDimensions?.height), [coverDimensions?.width, coverDimensions?.height]);
  const [contactEmail, setContactEmail] = useState(DEFAULT_CONTACT_EMAIL);
  const [landingUrl, setLandingUrl] = useState(initialLandingUrl);
  const backPanelTone = useMemo(() => getBackPanelTone(backPanelToneId), [backPanelToneId]);
  const backFrameTone = useMemo(() => getBackFrameTone(backFrameToneId), [backFrameToneId]);
  const frontTone = useMemo(() => getFrontTone(frontToneId), [frontToneId]);

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
  const qrActionLabel = getQrActionLabel(qrDestination);

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
      showNotice("Ficha JSON descargada", `${publicId}.json\nCópiala a public/music-cards/ y despliega Netlify. Después pulsa «Comprobar publicación».`, "success");
    } catch (error) { showNotice("Error al descargar", error.message || "No se pudo crear la ficha pública.", "error"); }
  };

  const verifyPublicManifest = async () => {
    const url = getPublicManifestUrl(publicBaseUrl, publicId);
    if (!url) { showNotice("URL no válida", "Indica una URL pública HTTPS válida.", "warning"); return; }
    setBusy(true);
    try {
      const response = await fetch(`${url}?check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Ficha no encontrada (HTTP ${response.status}).`);
      const data = await response.json();
      const expected = buildPublicManifest(playlist, publicId, isClassical);
      if (JSON.stringify(data) !== JSON.stringify(expected)) throw new Error("La ficha publicada no coincide con esta playlist. Vuelve a exportarla y desplegarla.");
      setPublished(true);
      showNotice("Publicación verificada", "La ficha pública coincide con la playlist. Puedes imprimir su código QR.", "success");
    } catch (error) {setPublished(false);showNotice("No se pudo comprobar la publicación", error?.message === "Failed to fetch" || error instanceof TypeError ? "No se ha podido conectar con Netlify. Comprueba la conexión, que la web esté desplegada y que el navegador permita la solicitud (CORS)." : (error.message || "No se pudo comprobar la publicación."), "error");}
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
    if (Number.isFinite(asset.width) && Number.isFinite(asset.height)) {
      setCoverDimensions({ uri, width: asset.width, height: asset.height });
    } else {
      setCoverDimensions(null);
    }
    setCoverUri(uri);
  };

  const print = () => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !targetUrl) return;
    if (cardMode === "playlist" && qrDestination !== "youtube" && !published) {
      showNotice("Publicación pendiente", "Antes de imprimir, exporta la ficha JSON, publícala en Netlify y comprueba su URL.", "warning");
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
      showBackGridOnFront,
      gridStyles,
      qrActionLabel,
      doubleSided,
      duplexFlip,
      backOffsetX,
      backOffsetY,
      backInsetEnabled,
      backInsetMm,
      frontBackground: frontTone.printBackground || frontTone.bg,
      backPanelBg: backPanelTone.bg,
      backFrameBg: backFrameTone.bg,
      backPanelTitleColor: backPanelTone.title,
      backPanelMetaColor: backPanelTone.meta,
      backPanelAccentColor: backPanelTone.accent,
      coverUri,
      contactEmail,
      landingUrl,
      coverOverscan: coverRenderScale,
    });
    const w = window.open("", "_blank");
    if (!w) {
      showNotice("Ventana bloqueada", "Permite las ventanas emergentes para Shopp en tu navegador e inténtalo de nuevo.", "warning");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setPrintOpen(false);
  };

  // Controles compartidos de edición; cada cuadrícula mantiene su propio estilo.
  const renderGridStyleControls = (side) => {
    const current = gridStyles[side];
    const style = safeGridLineStyle(current, DEFAULT_GRID_STYLES[side]);
    const atWidthIndex = GRID_WIDTH_OPTIONS.indexOf(current.width);
    return (
      <View style={styles.gridStylePanel}>
        <Text style={styles.gridStyleTitle}>Tipo de línea</Text>
        <Text style={styles.fieldLabel}>Color</Text>
        <View style={styles.gridColorsRow}>
          {GRID_COLOR_OPTIONS.map(option => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`Color ${option.label}`}
              accessibilityState={{ selected: current.color.toLowerCase() === option.value.toLowerCase() }}
              onPress={() => updateGridStyle(side, "color", option.value)}
              style={[styles.gridColorButton, current.color.toLowerCase() === option.value.toLowerCase() && styles.gridColorButtonActive]}
            >
              <View style={[styles.gridColorDot, { backgroundColor: option.value }]} />
            </Pressable>
          ))}
          <TextInput
            accessibilityLabel="Color hexadecimal de la cuadrícula"
            value={current.color}
            onChangeText={value => updateGridStyle(side, "color", value.slice(0, 7))}
            placeholder="#555555"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            style={styles.gridHexInput}
          />
        </View>
        {!/^#[0-9a-f]{6}$/i.test(current.color) ? (
          <Text style={styles.gridInputHint}>Introduce un color hexadecimal completo (#RRGGBB). Se usará el color por defecto hasta que sea válido.</Text>
        ) : null}
        <View style={styles.gridWidthRow}>
          <Text style={styles.fieldLabel}>Espesor</Text>
          <View style={styles.gridWidthCounter}>
            <Pressable
              accessibilityLabel="Reducir espesor de línea"
              disabled={atWidthIndex <= 0}
              onPress={() => changeGridWidth(side, -1)}
              style={[styles.gridWidthButton, atWidthIndex <= 0 && styles.disabled]}
            >
              <Ionicons name="remove" size={16} color="#0f172a" />
            </Pressable>
            <Text style={styles.gridWidthValue}>{current.width.toFixed(2)} mm</Text>
            <Pressable
              accessibilityLabel="Aumentar espesor de línea"
              disabled={atWidthIndex >= GRID_WIDTH_OPTIONS.length - 1}
              onPress={() => changeGridWidth(side, 1)}
              style={[styles.gridWidthButton, atWidthIndex >= GRID_WIDTH_OPTIONS.length - 1 && styles.disabled]}
            >
              <Ionicons name="add" size={16} color="#0f172a" />
            </Pressable>
          </View>
        </View>
        <Text style={styles.fieldLabel}>Patrón</Text>
        <View style={styles.gridPatternsRow}>
          {GRID_PATTERN_OPTIONS.map(option => (
            <Pressable
              key={option.id}
              onPress={() => updateGridStyle(side, "pattern", option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: current.pattern === option.id }}
              style={[styles.gridPatternButton, current.pattern === option.id && styles.gridPatternButtonActive]}
            >
              <View style={[styles.gridPatternSample, {
                borderTopWidth: 2,
                borderTopColor: style.color,
                borderTopStyle: option.id,
              }]} />
              <Text style={[styles.gridPatternLabel, current.pattern === option.id && styles.gridPatternLabelActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.gridLinePreviewBox}>
          <Text style={styles.gridPreviewLabel}>Vista previa del trazo</Text>
          <View style={[styles.gridLinePreviewStroke, {
            borderTopWidth: Math.max(1, current.width * 10),
            borderTopColor: style.color,
            borderTopStyle: style.pattern,
          }]} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pageIntro}>
          <View style={styles.pageTitleRow}>
            <View style={styles.pageIcon}><Ionicons name="card-outline" size={23} color="#2563eb" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heading}>Tarjetas musicales</Text>
              <Text style={styles.help}>Diseña tarjetas de 90 × 56 mm con la imagen, el QR y los datos de Shopp.</Text>
            </View>
          </View>
        </View>

        <View style={styles.fields}>
          <View style={styles.formSection}>
            <View style={styles.sectionHeading}>
              <Ionicons name="albums-outline" size={21} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Contenido de las tarjetas</Text>
                <Text style={styles.sectionSubtitle}>Selecciona lo que quieres imprimir.</Text>
              </View>
            </View>
            <View style={styles.choicesGrid}>
              {[
                ["songs", "Canciones distintas", "Una tarjeta por canción válida", "musical-notes-outline"],
                ["single", "Primera canción", "Varias copias de un tema", "disc-outline"],
                ["playlist", "Playlist completa", "Un QR para toda la lista", "list-outline"],
              ].map(([value, label, detail, icon]) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: cardMode === value }}
                  onPress={() => { setCardMode(value); setPublished(false); }}
                  style={[styles.choiceTile, cardMode === value && styles.choiceTileActive]}
                >
                  <View style={styles.choiceTop}>
                    <Ionicons name={icon} size={19} color={cardMode === value ? "#1d4ed8" : "#64748b"} />
                    <Ionicons name={cardMode === value ? "radio-button-on" : "radio-button-off"} size={19} color={cardMode === value ? "#2563eb" : "#94a3b8"} />
                  </View>
                  <Text style={styles.choiceTitle}>{label}</Text>
                  <Text style={styles.choiceDescription}>{detail}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inlineHint}>
              <Ionicons name="information-circle-outline" size={16} color="#64748b" />
              <Text style={styles.inlineHintText}>
                {cardMode === "songs"
                  ? `${Math.min(cardEntries.length, 99)} canciones válidas; hasta 10 tarjetas por hoja A4.`
                  : cardMode === "single"
                    ? "Puedes elegir cuántas copias hacer desde el cuadro de impresión."
                    : "Para compartir la playlist debes publicar su ficha JSON si el QR abre Shopp."}
              </Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeading}>
              <Ionicons name="qr-code-outline" size={21} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Destino del código QR</Text>
                <Text style={styles.sectionSubtitle}>Elige qué verá quien escanee la tarjeta.</Text>
              </View>
            </View>
            <View style={styles.choicesGrid}>
              {[
                ["landing", "Página Shopp", "YouTube y reproductor público", "globe-outline"],
                ["youtube", "YouTube", "Abrir la canción directamente", "logo-youtube"],
                ["shopp", "Reproductor Shopp", "Abrir el reproductor público", "play-circle-outline"],
              ].map(([value, label, detail, icon]) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: qrDestination === value }}
                  onPress={() => { setQrDestination(value); setPublished(false); }}
                  style={[styles.choiceTile, qrDestination === value && styles.choiceTileActive]}
                >
                  <View style={styles.choiceTop}>
                    <Ionicons name={icon} size={19} color={qrDestination === value ? "#1d4ed8" : "#64748b"} />
                    <Ionicons name={qrDestination === value ? "radio-button-on" : "radio-button-off"} size={19} color={qrDestination === value ? "#2563eb" : "#94a3b8"} />
                  </View>
                  <Text style={styles.choiceTitle}>{label}</Text>
                  <Text style={styles.choiceDescription}>{detail}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Dirección pública de Shopp</Text>
              <TextInput
                value={publicBaseUrl}
                onChangeText={(value) => { setPublicBaseUrl(value); setPublished(false); }}
                style={styles.input}
                keyboardType="url"
                autoCapitalize="none"
                placeholder="https://mi-shopp.netlify.app"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.fieldHelp}>Para entregar tarjetas, utiliza la URL HTTPS publicada, no localhost.</Text>
            </View>
            {cardMode === "playlist" && qrDestination !== "youtube" ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>Publicación de la playlist</Text>
                <Text style={styles.infoBoxText}>Descarga la ficha JSON, cópiala a public/music-cards/ y despliega Netlify. No se publican letras LRC ni datos privados.</Text>
                <View style={styles.actionRow}>
                  <Pressable style={styles.secondaryButton} onPress={downloadPublicManifest}>
                    <Ionicons name="download-outline" color="#2563eb" size={17} />
                    <Text style={styles.secondaryButtonText}>Descargar ficha JSON</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, busy && styles.disabled]} onPress={verifyPublicManifest} disabled={busy}>
                    <Ionicons name="checkmark-circle-outline" color="#2563eb" size={17} />
                    <Text style={styles.secondaryButtonText}>{busy ? "Comprobando..." : "Comprobar publicación"}</Text>
                  </Pressable>
                </View>
                <Text style={styles.fieldHelp}>{published ? "✓ Ficha publicada y comprobada" : `Ruta: public/music-cards/${publicId}.json`}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeading}>
              <Ionicons name="create-outline" size={21} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Textos e imágenes</Text>
                <Text style={styles.sectionSubtitle}>Datos musicales en el reverso y contacto en el anverso.</Text>
              </View>
            </View>
            <Text style={styles.subsectionTitle}>Reverso · Música</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Autor</Text>
                <TextInput value={author} onChangeText={setAuthor} style={styles.input} placeholder="Alan Parsons Project" placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Single</Text>
                <TextInput value={single} onChangeText={setSingle} style={styles.input} placeholder="Eye in the Sky" placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Subtítulo</Text>
                <TextInput value={subtitle} onChangeText={setSubtitle} style={styles.input} placeholder="1 item" placeholderTextColor="#94a3b8" />
              </View>
            </View>
            <View style={styles.imagePickerRow}>
              <View style={styles.coverThumbnailBox}>
                {coverUri ? (
                  <Image
                    source={{ uri: coverUri }}
                    style={[styles.coverThumbnail, { transform: [{ scale: coverRenderScale }] }]}
                    resizeMode="cover"
                    accessibilityLabel="Miniatura de la carátula seleccionada"
                  />
                ) : (
                  <Ionicons name="image-outline" size={28} color="#94a3b8" />
                )}
              </View>
              <View style={styles.coverDetails}>
                <Text style={styles.fieldLabel}>Carátula del single</Text>
                <Text style={styles.coverDimensions}>{coverSizeLabel}</Text>
                <Text style={styles.fieldHelp}>Vista cuadrada con recorte centrado, sin deformar la imagen.</Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable onPress={pickCover} style={styles.secondaryButton}>
                  <Ionicons name="image-outline" size={17} color="#2563eb" />
                  <Text style={styles.secondaryButtonText}>{coverUri ? "Cambiar carátula" : "Elegir carátula"}</Text>
                </Pressable>
                {coverUri ? (
                  <Pressable onPress={() => { setCoverDimensions(null); setCoverUri(""); }} style={styles.removeCover}>
                    <Text style={styles.removeCoverText}>Quitar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <View style={styles.sectionDivider} />
            <Text style={styles.subsectionTitle}>Anverso · Contacto</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Correo electrónico</Text>
                <TextInput value={contactEmail} onChangeText={setContactEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="info@ramshopp.com" placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Página de Shopp</Text>
                <TextInput value={landingUrl} onChangeText={setLandingUrl} style={styles.input} autoCapitalize="none" keyboardType="url" placeholder="https://..." placeholderTextColor="#94a3b8" />
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeading}>
              <Ionicons name="color-palette-outline" size={21} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Colores y acabado</Text>
                <Text style={styles.sectionSubtitle}>Personaliza cada cara por separado.</Text>
              </View>
            </View>
            <Text style={styles.subsectionTitle}>Fondo del anverso</Text>
            <View style={styles.toneGrid}>
              {FRONT_TONES.map((tone) => (
                <Pressable key={tone.id} onPress={() => setFrontToneId(tone.id)} accessibilityRole="radio" accessibilityState={{ selected: frontToneId === tone.id }} style={[styles.toneChip, frontToneId === tone.id && styles.toneChipActive]}>
                  <View style={[styles.toneSwatch, { backgroundColor: tone.bg, overflow: "hidden" }]}>
                    {tone.id === "original" && Platform.OS === "web" ? <Image source={{ uri: FRONT_GRADIENT_PREVIEW_URI }} style={styles.frontToneGradientSwatch} resizeMode="stretch" /> : tone.id === "transparent" ? <Image source={{ uri: TRANSPARENT_SWATCH_URI }} style={styles.frontToneGradientSwatch} resizeMode="stretch" /> : null}
                  </View>
                  <Text style={styles.toneLabel}>{tone.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sectionDivider} />
            <Text style={styles.subsectionTitle}>Marco y bandas laterales del reverso</Text>
            <Text style={styles.fieldHelp}>Marco exterior de 10 mm por defecto; la carátula se ajusta a un cuadrado, sin franjas laterales.</Text>
            <View style={styles.toneGrid}>
              {BACK_FRAME_TONES.map((tone) => (
                <Pressable key={tone.id} onPress={() => setBackFrameToneId(tone.id)} accessibilityRole="radio" accessibilityState={{ selected: backFrameToneId === tone.id }} style={[styles.toneChip, backFrameToneId === tone.id && styles.toneChipActive]}>
                  <View style={[styles.toneSwatch, { backgroundColor: tone.bg, overflow: "hidden" }]}>
                    {tone.id === "transparent" ? <Image source={{ uri: TRANSPARENT_SWATCH_URI }} style={styles.frontToneGradientSwatch} resizeMode="stretch" /> : null}
                  </View>
                  <Text style={styles.toneLabel}>{tone.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sectionDivider} />
            <Text style={styles.subsectionTitle}>Panel derecho del reverso</Text>
            <View style={styles.toneGrid}>
              {BACK_PANEL_TONES.map((tone) => (
                <Pressable key={tone.id} onPress={() => setBackPanelToneId(tone.id)} accessibilityRole="radio" accessibilityState={{ selected: backPanelToneId === tone.id }} style={[styles.toneChip, backPanelToneId === tone.id && styles.toneChipActive]}>
                  <View style={[styles.toneSwatch, { backgroundColor: tone.bg, overflow: "hidden" }]}>
                    {tone.id === "transparent" ? <Image source={{ uri: TRANSPARENT_SWATCH_URI }} style={styles.frontToneGradientSwatch} resizeMode="stretch" /> : null}
                  </View>
                  <Text style={styles.toneLabel}>{tone.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.toggleRow} onPress={() => setBackInsetEnabled((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: backInsetEnabled }}>
              <Ionicons name={backInsetEnabled ? "checkbox" : "square-outline"} size={23} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Margen de color en el reverso</Text>
                <Text style={styles.fieldHelp}>Un marco del color elegido alrededor de la imagen y del panel QR.</Text>
              </View>
            </Pressable>
            {backInsetEnabled ? (
              <View style={styles.compactControlRow}>
                <Text style={styles.fieldLabel}>Ancho del margen</Text>
                <View style={styles.counter}>
                  <Pressable accessibilityLabel="Reducir margen" onPress={() => setBackInsetMm(v => nextBackInset(v, -CALIBRATION_STEP_MM))} style={styles.counterButton}><Ionicons name="remove" size={18} color="#0f172a" /></Pressable>
                  <Text style={styles.counterValue}>{backInsetMm.toFixed(1)} mm</Text>
                  <Pressable accessibilityLabel="Aumentar margen" onPress={() => setBackInsetMm(v => nextBackInset(v, CALIBRATION_STEP_MM))} style={styles.counterButton}><Ionicons name="add" size={18} color="#0f172a" /></Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.inlineHint}>
              <Ionicons name="information-circle-outline" size={16} color="#64748b" />
              <Text style={styles.inlineHintText}>Transparente no aplica tinta de fondo. Las líneas de corte se configuran al imprimir.</Text>
            </View>
          </View>
        </View>

        <View style={styles.previewSection}>
          <View style={styles.sectionHeading}>
            <Ionicons name="eye-outline" size={21} color="#2563eb" />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Vista previa de la tarjeta</Text>
              <Text style={styles.sectionSubtitle}>Así se verán las dos caras con los colores elegidos.</Text>
            </View>
          </View>
        <View style={styles.previewRow}>
          <View>
            <Text style={styles.sideLabel}>ANVERSO</Text>
            <View style={[styles.card, styles.shoppFrontCard, { width: previewCardWidth, height: previewCardHeight, backgroundColor: frontTone.bg }]}>
              {frontTone.id === "original" && Platform.OS === "web" ? (
                <Image source={{ uri: FRONT_GRADIENT_PREVIEW_URI }} style={styles.frontGradientPreview} resizeMode="stretch" pointerEvents="none" />
              ) : null}
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
            <View style={[styles.card, styles.musicBackCard, { width: previewCardWidth, height: previewCardHeight, backgroundColor: backFrameTone.bg, padding: previewInsetPx }]}>
              <View style={styles.backInnerPreview}>
                <View style={[styles.coverPanelPreview, {
                  width: previewCoverSizePx,
                  minWidth: previewCoverSizePx,
                  flexBasis: previewCoverSizePx,
                  flexGrow: 0,
                  flexShrink: 0,
                  backgroundColor: backFrameTone.bg,
                }]}>
                  {coverUri ? (
                    <Image
                      source={{ uri: coverUri }}
                      resizeMode="cover"
                      style={[styles.coverPreview, { transform: [{ scale: coverRenderScale }] }]}
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
                <View style={[styles.backInfoPreview, { backgroundColor: backPanelTone.bg }, previewCompactBack && styles.backInfoCompactPreview]}>
                  <View style={styles.musicMetaPreview}>
                    {author ? (
                      <Text style={[styles.musicAuthor, { color: backPanelTone.accent }, previewCompactBack && styles.musicAuthorCompact]} numberOfLines={1}>
                        {author}
                      </Text>
                    ) : null}
                    <Text style={[styles.musicTitle, { color: backPanelTone.title }, previewCompactBack && styles.musicTitleCompact]} numberOfLines={2}>
                      {single || title}
                    </Text>
                    {subtitle ? (
                      <Text style={[styles.musicSubtitle, { color: backPanelTone.meta }, previewCompactBack && styles.musicSubtitleCompact]} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {targetUrl ? (
                    <View style={styles.qrPanelPreview}>
                      <Image
                        source={{ uri: qrUrl(targetUrl) }}
                        style={[styles.qrBack, { width: previewQrSizePx, height: previewQrSizePx }]}
                        resizeMode="contain"
                      />
                      <Text style={[styles.qrHint, { color: backPanelTone.accent }, previewCompactBack && styles.qrHintCompact]}>
                        {qrActionLabel}
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
        </View>
        <Text style={styles.note}>
          Texto impreso bajo el QR: «{qrActionLabel.replace("\n", " ")}». Para compartir
          playlists completas en otro dispositivo, publica antes su ficha JSON estática en Netlify.
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
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Preparar impresión</Text>
                <Text style={styles.modalHeaderHelp}>Formato, caras, corte y alineación.</Text>
              </View>
              <Pressable onPress={() => setPrintOpen(false)} accessibilityLabel="Cerrar impresión" style={styles.modalClose}>
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalSectionTitle}>1. Formato de papel</Text>
              <View style={styles.modalChoiceRow}>
                {[
                  ["a4", "Hoja A4", "Hasta 10 tarjetas", "grid-outline"],
                  ["card", "Tarjeta", "90 × 56 mm", "card-outline"],
                ].map(([value, label, detail, icon]) => (
                  <Pressable key={value} onPress={() => setFormat(value)} accessibilityRole="radio" accessibilityState={{ selected: format === value }} style={[styles.modalChoice, format === value && styles.choiceTileActive]}>
                    <View style={styles.choiceTop}>
                      <Ionicons name={icon} size={19} color="#2563eb" />
                      <Ionicons name={format === value ? "radio-button-on" : "radio-button-off"} size={18} color="#2563eb" />
                    </View>
                    <Text style={styles.choiceTitle}>{label}</Text>
                    <Text style={styles.choiceDescription}>{detail}</Text>
                  </Pressable>
                ))}
              </View>

              {format === "a4" ? (
                <View style={styles.modalFieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{cardMode === "songs" ? "Tarjetas diferentes" : "Número de copias"}</Text>
                    <Text style={styles.fieldHelp}>{cardMode === "songs" ? "Una por canción válida" : "Distribuidas en hojas de 10"}</Text>
                  </View>
                  <View style={styles.counter}>
                    <Pressable disabled={cardMode === "songs"} onPress={() => changeCopies(-1)} style={[styles.counterButton, cardMode === "songs" && styles.disabled]}><Ionicons name="remove" size={18} color="#0f172a" /></Pressable>
                    <Text style={styles.counterValue}>{cardMode === "songs" ? Math.min(cardEntries.length,99) : copies}</Text>
                    <Pressable disabled={cardMode === "songs"} onPress={() => changeCopies(1)} style={[styles.counterButton, cardMode === "songs" && styles.disabled]}><Ionicons name="add" size={18} color="#0f172a" /></Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.modalDivider} />
              <Text style={styles.modalSectionTitle}>2. Caras de impresión</Text>
              <Pressable onPress={() => setDoubleSided(v => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: doubleSided }} style={styles.modalToggleRow}>
                <Ionicons name={doubleSided ? "checkbox" : "square-outline"} size={23} color="#2563eb" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Imprimir anverso y reverso</Text>
                  <Text style={styles.fieldHelp}>Genera ambas caras listas para impresión dúplex.</Text>
                </View>
              </Pressable>
              {format === "a4" && doubleSided ? (
                <View style={styles.modalSubgroup}>
                  <Text style={styles.fieldLabel}>Volteo de la hoja</Text>
                  <View style={styles.segmentRow}>
                    {[ ["long", "Borde largo"], ["short", "Borde corto"] ].map(([value, label]) => (
                      <Pressable key={value} onPress={() => setDuplexFlip(value)} accessibilityRole="radio" accessibilityState={{ selected: duplexFlip === value }} style={[styles.segmentOption, duplexFlip === value && styles.segmentOptionActive]}>
                        <Ionicons name={duplexFlip === value ? "radio-button-on" : "radio-button-off"} size={17} color="#2563eb" />
                        <Text style={[styles.segmentText, duplexFlip === value && styles.segmentTextActive]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {format === "a4" ? (
                <>
                  <View style={styles.modalDivider} />
                  <Text style={styles.modalSectionTitle}>3. Líneas de corte y guías</Text>
                  <Text style={styles.fieldHelp}>Puedes activar cada cuadrícula y configurar su color, espesor y patrón por separado.</Text>
                  <View style={styles.modalSubgroup}>
                    <Pressable onPress={() => setFrontCropMarks(v => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: frontCropMarks }} style={styles.compactCheckRow}>
                      <Ionicons name={frontCropMarks ? "checkbox" : "square-outline"} size={22} color="#2563eb" />
                      <Text style={styles.toggleLabel}>Cuadrícula de corte en el anverso</Text>
                    </Pressable>
                    {frontCropMarks ? renderGridStyleControls("front") : null}
                    {doubleSided ? (
                      <>
                        <Pressable onPress={() => setBackCropMarks(v => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: backCropMarks }} style={styles.compactCheckRow}>
                          <Ionicons name={backCropMarks ? "checkbox" : "square-outline"} size={22} color="#2563eb" />
                          <Text style={styles.toggleLabel}>Cuadrícula de corte en el reverso</Text>
                        </Pressable>
                        {backCropMarks ? renderGridStyleControls("back") : null}
                      </>
                    ) : null}
                  </View>
                  {doubleSided ? (
                    <Pressable
                      onPress={() => setShowBackGridOnFront(v => !v)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: showBackGridOnFront }}
                      style={styles.modalToggleRow}
                    >
                      <Ionicons name={showBackGridOnFront ? "checkbox" : "square-outline"} size={23} color="#2563eb" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>Mostrar cuadrícula del reverso en el anverso</Text>
                        <Text style={styles.fieldHelp}>Guía (2 × 5) para comprobar la alineación. Respeta el volteo y la calibración X/Y. Se imprime en el anverso.</Text>
                      </View>
                    </Pressable>
                  ) : null}
                  {doubleSided && showBackGridOnFront ? renderGridStyleControls("overlay") : null}

                  {doubleSided ? (
                    <>
                      <View style={styles.modalDivider} />
                      <Text style={styles.modalSectionTitle}>4. Calibración del reverso</Text>
                      <Text style={styles.fieldHelp}>Ajustes en pasos de 0,5 mm. Solo desplazan el reverso, sin cambiar el tamaño de la hoja ni de las tarjetas.</Text>
                      <View style={styles.calibrationRow}>
                        <Text style={styles.calibrationLabel}>Horizontal (X)</Text>
                        <Pressable accessibilityLabel="Mover reverso 0,5 mm a la izquierda" onPress={() => setBackOffsetX(v => nextOffset(v, -CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="remove" size={18} color="#0f172a" /></Pressable>
                        <Text style={styles.calibrationValue}>{backOffsetX > 0 ? "+" : ""}{backOffsetX.toFixed(1)} mm</Text>
                        <Pressable accessibilityLabel="Mover reverso 0,5 mm a la derecha" onPress={() => setBackOffsetX(v => nextOffset(v, CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="add" size={18} color="#0f172a" /></Pressable>
                      </View>
                      <View style={styles.calibrationRow}>
                        <Text style={styles.calibrationLabel}>Vertical (Y)</Text>
                        <Pressable accessibilityLabel="Subir reverso 0,5 mm" onPress={() => setBackOffsetY(v => nextOffset(v, -CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="remove" size={18} color="#0f172a" /></Pressable>
                        <Text style={styles.calibrationValue}>{backOffsetY > 0 ? "+" : ""}{backOffsetY.toFixed(1)} mm</Text>
                        <Pressable accessibilityLabel="Bajar reverso 0,5 mm" onPress={() => setBackOffsetY(v => nextOffset(v, CALIBRATION_STEP_MM))} style={styles.calibrationButton}><Ionicons name="add" size={18} color="#0f172a" /></Pressable>
                      </View>
                      <Pressable onPress={() => { setBackOffsetX(DEFAULT_BACK_OFFSET_X_MM); setBackOffsetY(DEFAULT_BACK_OFFSET_Y_MM); }} style={styles.resetCalibration}><Text style={styles.resetCalibrationText}>Restablecer: X 0 mm · Y +2,5 mm</Text></Pressable>
                    </>
                  ) : null}
                  <Text style={styles.capacity}>Hoja A4: 2 columnas × 5 filas (10 tarjetas por página).</Text>
                </>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPrintOpen(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={print} style={styles.previewButton}>
                <Ionicons name="print-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Vista previa / Imprimir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(notice)} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
        <View style={styles.noticeBackdrop}>
          <View style={styles.noticeCard}>
            <View style={styles.noticeHeading}>
              <Ionicons name={notice?.type === "success" ? "checkmark-circle-outline" : notice?.type === "error" ? "alert-circle-outline" : "information-circle-outline"} size={26} color={notice?.type === "success" ? "#16a34a" : notice?.type === "error" ? "#dc2626" : "#2563eb"} />
              <Text style={styles.noticeTitle}>{notice?.title}</Text>
            </View>
            <Text style={styles.noticeMessage}>{notice?.message}</Text>
            <Pressable accessibilityRole="button" onPress={() => setNotice(null)} style={styles.noticeButton}>
              <Text style={styles.noticeButtonText}>Aceptar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  noticeBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.48)", alignItems: "center", justifyContent: "center", padding: 20 },
  noticeCard: { width: "100%", maxWidth: 440, backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  noticeHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  noticeTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", flex: 1 },
  noticeMessage: { fontSize: 15, color: "#475569", lineHeight: 23, marginBottom: 20 },
  noticeButton: { backgroundColor: "#2563eb", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 9, alignSelf: "flex-end" },
  noticeButtonText: { color: "#fff", fontWeight: "700" },
  pageIntro: { width: "100%", maxWidth: 820, paddingHorizontal: 2, marginBottom: 2 },
  pageTitleRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  pageIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#dbeafe" },
  formSection: { width: "100%", padding: 18, gap: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  sectionSubtitle: { fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 18 },
  subsectionTitle: { fontSize: 14, fontWeight: "700", color: "#334155" },
  sectionDivider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 3 },
  choicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  choiceTile: { flexBasis: 190, flexGrow: 1, minWidth: 180, minHeight: 100, borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ed", backgroundColor: "#f8fafc", padding: 12, gap: 5 },
  choiceTileActive: { borderColor: "#2563eb", borderWidth: 2, backgroundColor: "#eff6ff" },
  choiceTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  choiceTitle: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  choiceDescription: { fontSize: 11, lineHeight: 16, color: "#64748b" },
  inlineHint: { flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: "#f8fafc", borderRadius: 8, padding: 10 },
  inlineHintText: { flex: 1, color: "#64748b", fontSize: 12, lineHeight: 17 },
  inputGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  inputField: { flex: 1, minWidth: 220, gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  fieldHelp: { fontSize: 11, color: "#64748b", lineHeight: 16 },
  infoBox: { gap: 10, padding: 13, backgroundColor: "#f1f5f9", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  infoBoxTitle: { color: "#334155", fontSize: 13, fontWeight: "700" },
  infoBoxText: { color: "#475569", fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  imagePickerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  coverThumbnailBox: {
    width: 76,
    height: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  coverThumbnail: { width: "100%", height: "100%" },
  coverDetails: { flex: 1, minWidth: 170, gap: 4 },
  coverDimensions: { fontSize: 12, color: "#1d4ed8", fontWeight: "700" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#e2e8f0", padding: 12, borderRadius: 9 },
  toggleLabel: { fontSize: 13, color: "#1e293b", fontWeight: "600" },
  compactControlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  previewSection: { width: "100%", maxWidth: 820, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 18, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 15, borderBottomWidth: 1, borderColor: "#e2e8f0" },
  modalHeaderHelp: { color: "#64748b", fontSize: 12 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  modalSectionTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  modalChoiceRow: { flexDirection: "row", gap: 9 },
  modalChoice: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ed", backgroundColor: "#f8fafc", padding: 12, gap: 4 },
  modalFieldRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" },
  modalDivider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 4 },
  modalToggleRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, backgroundColor: "#f8fafc", borderRadius: 8 },
  modalSubgroup: { gap: 10 },
  segmentRow: { flexDirection: "row", gap: 8 },
  segmentOption: { flex: 1, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", padding: 10, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, backgroundColor: "#fff" },
  segmentOptionActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  segmentText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  segmentTextActive: { color: "#1d4ed8" },
  compactCheckRow: { flexDirection: "row", gap: 9, alignItems: "center", paddingVertical: 3 },
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, alignItems: "center", gap: 16, paddingBottom: 40 },
  heading: { fontSize: 25, fontWeight: "800", color: "#0f172a" },
  help: { color: "#64748b", fontSize: 12, lineHeight: 18, marginTop: 3 },
  fields: { width: "100%", maxWidth: 820, gap: 14 },
  label: { fontWeight: "600", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
  },
  previewRow: {
    width: "100%",
    maxWidth: 780,
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
    // No usar flex: 0: React Native Web lo interpreta como base 0 y oculta la carátula.
    flexGrow: 0,
    flexShrink: 0,
    height: "100%",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverPreview: { width: "100%", height: "100%", resizeMode: "cover" },
  coverEmpty: {
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  coverEmptyText: { color: "#64748b", fontWeight: "600" },
  backInfoPreview: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingHorizontal: 5,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
    overflow: "hidden",
  },
  backInfoCompactPreview: { paddingHorizontal: 3, paddingVertical: 2, gap: 1 },
  musicMetaPreview: { width: "100%", alignItems: "center", flexGrow: 1, flexShrink: 1, minHeight: 0, overflow: "hidden" },
  musicAuthorCompact: { fontSize: 8, marginBottom: 1, lineHeight: 9 },
  musicTitleCompact: { fontSize: 10, lineHeight: 11 },
  musicSubtitleCompact: { fontSize: 7, lineHeight: 9, marginTop: 1 },
  qrHintCompact: { fontSize: 7, lineHeight: 8 },
  musicAuthor: {
    fontWeight: "700",
    fontSize: 10,
    marginBottom: 2,
    textAlign: "center",
  },
  musicTitle: {
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  musicSubtitle: {
    fontSize: 9,
    marginTop: 2,
    textAlign: "center",
  },
  qrPanelPreview: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 7,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2, // el bloque del QR se reserva por debajo de los metadatos
  },
  qrBack: { width: 68, height: 68 },
  qrHint: {
    fontSize: 8,
    lineHeight: 9,
    textAlign: "center",
    fontWeight: "700",
    color: "#334155",
    marginTop: 2,
    flexShrink: 0,
    width: "100%",
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
  toneGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toneChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff" },
  toneChipActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  toneSwatch: { width: 16, height: 16, borderRadius: 999, borderWidth: 1, borderColor: "rgba(15,23,42,.10)" },
  toneLabel: { color: "#334155", fontSize: 13, fontWeight: "600" },
  frontGradientPreview: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  frontToneGradientSwatch: { width: "100%", height: "100%" },
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
    maxWidth: 540,
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  modalScrollContent: { padding: 20, gap: 12, paddingBottom: 22 },
  gridStylePanel: { padding: 12, gap: 8, marginTop: 3, marginBottom: 8, marginLeft: 9, backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: "#dbe3ed" },
  gridStyleTitle: { fontSize: 13, fontWeight: "700", color: "#334155" },
  gridColorsRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center" },
  gridColorButton: { width: 31, height: 31, padding: 4, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  gridColorButtonActive: { borderWidth: 2, borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  gridColorDot: { width: 20, height: 20, borderRadius: 5 },
  gridHexInput: { minWidth: 90, flexGrow: 1, flexBasis: 100, height: 34, paddingHorizontal: 9, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 7, backgroundColor: "#fff", fontSize: 13, color: "#0f172a" },
  gridInputHint: { color: "#b45309", fontSize: 11, lineHeight: 16 },
  gridWidthRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 },
  gridWidthCounter: { flexDirection: "row", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 7, overflow: "hidden", backgroundColor: "#fff", alignItems: "center" },
  gridWidthButton: { width: 33, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" },
  gridWidthValue: { width: 92, textAlign: "center", fontSize: 13, color: "#0f172a", fontWeight: "700" },
  gridPatternsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  gridPatternButton: { flexGrow: 1, flexBasis: 108, minWidth: 95, paddingVertical: 8, paddingHorizontal: 7, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 7, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#fff" },
  gridPatternButtonActive: { borderWidth: 2, borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  gridPatternLabel: { fontSize: 11, color: "#475569", fontWeight: "600" },
  gridPatternLabelActive: { color: "#1d4ed8" },
  gridPatternSample: { width: "85%", height: 1 },
  gridLinePreviewBox: { gap: 8, padding: 9, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 7, backgroundColor: "#fff" },
  gridPreviewLabel: { fontSize: 11, color: "#64748b" },
  gridLinePreviewStroke: { width: "100%", height: 1 },
  calibrationRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 },
  calibrationLabel: { width: 110, color: "#334155", fontSize: 12, fontWeight: "600" },
  calibrationValue: { minWidth: 74, textAlign: "center", color: "#0f172a", fontWeight: "700" },
  calibrationButton: { width: 36, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9", borderRadius: 6, borderWidth: 1, borderColor: "#cbd5e1" },
  resetCalibration: { paddingVertical: 10, alignItems: "center" },
  resetCalibrationText: { color: "#2563eb", fontSize: 13, fontWeight: "600" },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 0,
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
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
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
