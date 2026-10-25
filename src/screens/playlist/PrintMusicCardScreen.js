import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
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
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as localRepo from "@/src/storage/playlists/playlistRepository";
import {
  buildSongCardUrl,
  buildPlaylistCardUrl,
  buildPublicManifest,
  comparePublicPlaylist,
  getPublicManifestUrl,
  normalizePublicBase,
  publicIdForPlaylist,
  videoIdFromTrack,
  youtubePlaylistIdFromTrack,
} from "@/src/services/musicCardLinks";

import { savePublicMusicCardZip } from "@/src/services/playlistArchiveZip";

const DEFAULT_CONTACT_EMAIL = "info@ramshopp.com";
const DEFAULT_LANDING_URL = "https://ramworks.netlify.app";

function initialLandingUrl() {
  return DEFAULT_LANDING_URL;
}

function selectionCardId(publicId, indices) {
  // Hash corto y determinista para no superar los 64 caracteres del ID público.
  const signature = [...indices].sort((a, b) => a - b).join(",");
  let hash = 2166136261;
  for (let i = 0; i < signature.length; i++) {
    hash = Math.imul(hash ^ signature.charCodeAt(i), 16777619) >>> 0;
  }
  return `${String(publicId).slice(0, 54).replace(/-+$/, "")}-s${hash.toString(16).padStart(8, "0")}`;
}

// Identificador lógico de pista independiente de su posición en la playlist.
// Los vídeos repetidos se diferencian con su ocurrencia al reconstruir la selección.
// Mismo identificador publicado por el catálogo (PlayListScreen.js).
function catalogWorkPublicId(playlist, work) {
  const value = `${publicIdForPlaylist(playlist)}:${work.id}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
  return `shopp-work-${hash.toString(16).padStart(8, "0")}`;
}
function workTrackKey(track) {
  return String(videoIdFromTrack(track) || youtubePlaylistIdFromTrack(track) || "").trim();
}
function workStorageKey(publicId) {
  return `shopp:print-works:v1:${publicId}`;
}
function matchWorkTrackIndices(keys, tracks) {
  const taken = new Set();
  const result = [];
  for (const key of keys || []) {
    const index = tracks.findIndex((track, i) => !taken.has(i) && workTrackKey(track) === key);
    if (index < 0) return null; // No reproducir una obra incompleta por error.
    taken.add(index);
    result.push(index);
  }
  return result.length ? result : null;
}

function qrUrl(value, size = 360) {
  return `https://quickchart.io/qr?size=${size}&margin=1&text=${encodeURIComponent(value)}`;
}

// La leyenda impresa coincide con el destino real configurado para el QR.
// Dos líneas permiten leerla sin reducir el tamaño del propio código QR.
function getQrActionLabel(destination) {
  switch (destination) {
    case "youtube":
      return "Escuchar en\nYouTube";
    case "shopp":
      return "Escuchar en\nShopp";
    case "landing":
    default:
      return "Ver en\nShopp";
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
const DEFAULT_BACK_INSET_MM = 4.5; // Marco exterior predeterminado de 10 mm en el reverso
const MIN_BACK_INSET_MM = 0;
const MAX_BACK_INSET_MM = 10;

// Estilos independientes de las tres cuadrículas. Las longitudes están en mm.
const GRID_WIDTH_OPTIONS = [0.05, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];
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
  front: { color: "#555555", width: 0.1, pattern: "solid" },
  back: { color: "#555555", width: 0.1, pattern: "solid" },
  overlay: { color: "#b4becb", width: 0.12, pattern: "dashed" },
};
function safeGridLineStyle(value, fallback) {
  return {
    color: /^#[0-9a-f]{6}$/i.test(value?.color || "")
      ? value.color
      : fallback.color,
    width: GRID_WIDTH_OPTIONS.includes(value?.width)
      ? value.width
      : fallback.width,
    pattern: GRID_PATTERN_OPTIONS.some((option) => option.id === value?.pattern)
      ? value.pattern
      : fallback.pattern,
  };
}
// SVG conserva el espesor vectorial en milímetros (CSS border redondea trazos
// inferiores a 1 px en algunos navegadores). El viewBox está expresado en mm.
function makeCutGridSvg(style) {
  const dash =
    style.pattern === "dashed"
      ? ' stroke-dasharray="2 1"'
      : style.pattern === "dotted"
        ? ' stroke-dasharray="0 1" stroke-linecap="round"'
        : "";
  const gridPath = [
    ...[0, 90, 180].map((x) => `M${x} 0V280`),
    ...[0, 56, 112, 168, 224, 280].map((y) => `M0 ${y}H180`),
  ].join(" ");
  return `<svg class="grid-vector" xmlns="http://www.w3.org/2000/svg" width="180mm" height="280mm" viewBox="0 0 180 280" aria-hidden="true"><path d="${gridPath}" fill="none" stroke="${style.color}" stroke-width="${style.width}"${dash}/></svg>`;
}
// Respetar el contenido completo de las carátulas, incluidos textos cerca del borde.
// La versión anterior aplicaba un zoom de 1.12 a imágenes cuadradas.
const DEFAULT_COVER_OVERSCAN = 1;

function getCoverOverscan(_width, _height) {
  return 1;
}

const BACK_PANEL_TONES = [
  {
    id: "sand",
    label: "Arena",
    bg: "#f6f0dd",
    title: "#1f2937",
    meta: "#64748b",
    accent: "#475569",
  },
  {
    id: "ice",
    label: "Azul hielo",
    bg: "#edf5ff",
    title: "#1e3a5f",
    meta: "#5f6f86",
    accent: "#4f6b8a",
  },
  {
    id: "sage",
    label: "Verde salvia",
    bg: "#eef5ee",
    title: "#1f3a2f",
    meta: "#64746a",
    accent: "#4e6b5d",
  },
  {
    id: "pearl",
    label: "Perla",
    bg: "#f7f2f5",
    title: "#3d2d39",
    meta: "#786674",
    accent: "#655664",
  },
  {
    id: "mist",
    label: "Gris niebla",
    bg: "#f3f4f6",
    title: "#1f2937",
    meta: "#6b7280",
    accent: "#4b5563",
  },
  {
    id: "transparent",
    label: "Transparente",
    bg: "transparent",
    title: "#1f2937",
    meta: "#64748b",
    accent: "#475569",
  },
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
const ORIGINAL_FRONT_BACKGROUND =
  "linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)";
const FRONT_TONES = [
  {
    id: "original",
    label: "Original (degradado)",
    bg: "#f8fafc",
    printBackground: ORIGINAL_FRONT_BACKGROUND,
  },
  { id: "white", label: "Blanco", bg: "#ffffff" },
  ...BACK_PANEL_TONES.map(({ id, label, bg }) => ({ id, label, bg })),
];
const DEFAULT_FRONT_TONE = "original";

// Representación del degradado original en la vista previa web, sin dependencias nuevas.
const FRONT_GRADIENT_PREVIEW_URI = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560" preserveAspectRatio="none"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#eff6ff"/></linearGradient></defs><rect width="900" height="560" fill="url(#bg)"/></svg>',
)}`;

// El tablero de ajedrez representa transparencia solo en la muestra del selector.
// No aparece sobre la tarjeta ni se imprime.
const TRANSPARENT_SWATCH_URI = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="#ffffff"/><path d="M0 0h12v12H0zM12 12h12v12H12z" fill="#cbd5e1"/></svg>',
)}`;

function nextOffset(value, delta) {
  return Math.max(
    MIN_BACK_OFFSET_MM,
    Math.min(
      MAX_BACK_OFFSET_MM,
      Math.round((value + delta) / CALIBRATION_STEP_MM) * CALIBRATION_STEP_MM,
    ),
  );
}

function nextBackInset(value, delta) {
  return Math.max(
    MIN_BACK_INSET_MM,
    Math.min(
      MAX_BACK_INSET_MM,
      Math.round((value + delta) / CALIBRATION_STEP_MM) * CALIBRATION_STEP_MM,
    ),
  );
}

function getBackPanelTone(toneId) {
  return (
    BACK_PANEL_TONES.find((option) => option.id === toneId) ||
    BACK_PANEL_TONES[0]
  );
}

function getBackFrameTone(toneId) {
  return (
    BACK_FRAME_TONES.find((option) => option.id === toneId) ||
    BACK_FRAME_TONES[0]
  );
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
  const safeEmail = esc(contactEmail);
  const safeLanding = esc(landingUrl);
  const frontBg = esc(
    frontBackground || "linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)",
  );
  const panelBg = esc(backPanelBg ?? "#f6f0dd");
  const frameBg = esc(backFrameBg ?? "#fff2bd");
  const panelTitleColor = esc(backPanelTitleColor || "#1f2937");
  const panelMetaColor = esc(backPanelMetaColor || "#64748b");
  const panelAccentColor = esc(backPanelAccentColor || "#475569");
  const printedQrAction = esc(qrActionLabel || "Ver en\nShopp").replace(
    /\n/g,
    "<br>",
  );
  const safeCoverScale = Number.isFinite(coverOverscan)
    ? Math.max(1, Math.min(1.2, coverOverscan))
    : DEFAULT_COVER_OVERSCAN;
  const backInset = backInsetEnabled
    ? Math.max(
        MIN_BACK_INSET_MM,
        Math.min(MAX_BACK_INSET_MM, Number(backInsetMm) || 0),
      )
    : 0;
  // Cada tarjeta mide 90 × 56 mm: reservando un cuadrado junto a un panel de 34 mm.
  // El margen se resta a los 4 lados y no cambia el tamaño exterior de la tarjeta.
  const coverSizeMm = 56 - 2 * backInset;
  // Con márgenes grandes, se reserva espacio vertical para autor, título, QR y leyenda.
  const qrSizeMm = Math.max(17.5, 20.5 - Math.max(0, backInset - 4) * 0.5);
  const compactBack = backInset >= 7;
  const frontLineSvg = makeCutGridSvg(
    safeGridLineStyle(gridStyles?.front, DEFAULT_GRID_STYLES.front),
  );
  const backLineSvg = makeCutGridSvg(
    safeGridLineStyle(gridStyles?.back, DEFAULT_GRID_STYLES.back),
  );
  const overlayLineSvg = makeCutGridSvg(
    safeGridLineStyle(gridStyles?.overlay, DEFAULT_GRID_STYLES.overlay),
  );
  const isCard = format === "card";
  const isDistinct = Boolean(distinctCards);
  const count = isCard
    ? 1
    : isDistinct
      ? cards.length
      : Math.max(1, Math.min(99, Number(copies) || 1));
  const perSheet = isCard ? 1 : 10;

  // El reverso se desplaza SOLO con los ajustes X/Y seleccionados en pantalla.
  // Sin compensacion vertical u horizontal adicional.
  // Una página de tamaño A4 completo evita el desbordamiento de Chrome.
  const dx = Number.isFinite(backOffsetX)
    ? Math.max(MIN_BACK_OFFSET_MM, Math.min(MAX_BACK_OFFSET_MM, backOffsetX))
    : 0;
  const dy = Number.isFinite(backOffsetY)
    ? Math.max(MIN_BACK_OFFSET_MM, Math.min(MAX_BACK_OFFSET_MM, backOffsetY))
    : DEFAULT_BACK_OFFSET_Y_MM;
  const frontCutGrid =
    !isCard && frontCropMarks
      ? `<div class="cut-guides" aria-hidden="true">${frontLineSvg}</div>`
      : "";
  const backCutGrid =
    !isCard && backCropMarks
      ? `<div class="cut-guides" aria-hidden="true">${backLineSvg}</div>`
      : "";

  // Proyección de la cuadrícula del REVERSO sobre la cara frontal del papel.
  // En A4, al voltear por el borde largo se refleja X; por el corto se refleja Y.
  // Incluir dx/dy permite ver en el anverso exactamente dónde quedaría el reverso
  // con la calibración seleccionada. No modifica la geometría de ninguna tarjeta.
  const backGridOnFront =
    !isCard && doubleSided && showBackGridOnFront
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
    const cardAuthor = esc(entry.author ?? author);
    const cardSubtitle = esc(entry.subtitle ?? subtitle);
    const cardCover = esc(entry.cover || coverUri);
    return `<div class="card-wrap"><div class="card back" style="padding:${backInset}mm;background:${frameBg};">
    <div class="back-inner">
      <div class="cover-panel" style="width:${coverSizeMm}mm;flex:0 0 ${coverSizeMm}mm;background:${frameBg};">${cardCover ? `<img class="cover" src="${cardCover}" alt="Carátula" style="transform:scale(${safeCoverScale});"/>` : `<div class="cover placeholder">Shopp Music</div>`}</div>
      <div class="back-info${compactBack ? " compact" : ""}" style="background:${panelBg};">
        <div class="music-meta">${cardAuthor ? `<span class="author" style="color:${panelAccentColor};">${cardAuthor}</span>` : ""}<strong style="color:${panelTitleColor};">${cardTitle}</strong>${cardSubtitle ? `<span class="subtitle" style="color:${panelMetaColor};">${cardSubtitle}</span>` : ""}</div>
        <div class="qr-panel"><img src="${q}" style="width:${qrSizeMm}mm;height:${qrSizeMm}mm;" alt="Código QR musical"/><span style="color:${panelAccentColor};">${printedQrAction}</span></div>
      </div>
    </div>
  </div></div>`;
  };

  const blank = () => `<div class="card-wrap blank"></div>`;
  const pages = [];
  for (let offset = 0; offset < count; offset += perSheet) {
    const slots = Array.from({ length: perSheet }, (_, i) =>
      offset + i < count ? cards[isDistinct ? offset + i : 0] : null,
    );
    pages.push(
      `<div class="sheet front-sheet"><div class="cards-grid">${slots.map((entry) => (entry ? front() : blank())).join("")}${frontCutGrid}</div>${backGridOnFront}</div>`,
    );
    if (doubleSided) {
      const backSlots = Array(perSheet).fill(null);
      slots.forEach((entry, i) => {
        if (!entry) return;
        const row = Math.floor(i / 2);
        const col = i % 2;
        const mapped = isCard
          ? 0
          : duplexFlip === "short"
            ? (4 - row) * 2 + col
            : row * 2 + (1 - col);
        backSlots[mapped] = entry;
      });
      pages.push(
        `<div class="sheet back-sheet"><div class="cards-grid">${backSlots.map((entry) => (entry ? back(entry) : blank())).join("")}${backCutGrid}</div></div>`,
      );
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
    .back{display:block;background:${frameBg}}.back-inner{width:100%;height:100%;display:flex;overflow:hidden}.cover-panel{min-width:0;height:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden;background:${frameBg}}.cover{width:100%;height:100%;display:block;object-fit:contain;object-position:center}.placeholder{display:flex;align-items:center;justify-content:center;background:#e2e8f0;color:#64748b;font-size:13pt;font-weight:700;text-align:center}.back-info{flex:1;min-width:0;height:100%;padding:1.5mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:.4mm;overflow:hidden}
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
  const previewCardHeight = (previewCardWidth * 56) / 90;
  const playlist = route.params?.playlist || {};
  const isClassical = Boolean(route.params?.isClassical);
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const [cardMode, setCardMode] = useState("playlist"); // QR directo al reproductor público
  const [customPlaylistReverses] = useState(false); // Diseño simplificado: reverso único
  const [qrDestination, setQrDestination] = useState("shopp");
  const [publicBaseUrl, setPublicBaseUrl] = useState(initialLandingUrl);
  const [publicId] = useState(() => publicIdForPlaylist(playlist));
  const [published, setPublished] = useState(false);
  const [includePublicLyrics, setIncludePublicLyrics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, type = "info") =>
    setNotice({ title, message: String(message || ""), type });
  const validTracks = useMemo(
    () =>
      tracks.filter(
        (t) => videoIdFromTrack(t) || youtubePlaylistIdFromTrack(t),
      ),
    [tracks],
  );
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
  // Los ajustes de cada tarjeta son temporales y no modifican la playlist original.
  const [prepareCardsOpen, setPrepareCardsOpen] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [cardOverrides, setCardOverrides] = useState({});
  const [exportingSelection, setExportingSelection] = useState(false);
  const [checkingSelection, setCheckingSelection] = useState(false);
  const [verifiedSelections, setVerifiedSelections] = useState({});
  const [savedWorks, setSavedWorks] = useState([]);
  const [sheetWorkIds, setSheetWorkIds] = useState([]);
  const [workMetadata, setWorkMetadata] = useState({ composer: "", conductor: "", orchestra: "", soloist: "" });
  const [worksLoaded, setWorksLoaded] = useState(false);
  // Catálogo de obras dentro del registro de la playlist clásica.
  // Las obras anteriores en AsyncStorage se migran sin borrar la copia heredada.
  const playlistId = playlist._id || playlist.id;
  useEffect(() => {
    let active = true;
    setWorksLoaded(false);
    setSavedWorks([]);
    (async () => {
      const current = isClassical && playlistId ? await localRepo.get(playlistId) : null;
      let catalog = Array.isArray(current?.works) ? current.works :
        (Array.isArray(playlist.works) ? playlist.works : []);
      const legacyRaw = await AsyncStorage.getItem(workStorageKey(publicId));
      const legacy = legacyRaw ? JSON.parse(legacyRaw) : [];
      if (!catalog.length && Array.isArray(legacy) && legacy.length) {
        catalog = legacy;
        if (isClassical && current) await localRepo.update(playlistId, { works: catalog });
      }
      if (active) setSavedWorks(catalog.filter(item =>
        item && typeof item.id === "string" && Array.isArray(item.trackKeys)
      ).slice(0, 100));
    })().catch(error => {
      if (active) showNotice("Obras guardadas", `No se pudo leer el catálogo: ${error?.message || error}`, "warning");
    }).finally(() => { if (active) setWorksLoaded(true); });
    return () => { active = false; };
  }, [publicId, playlistId, isClassical]);
  const persistWorks = async (next) => {
    try {
      if (!isClassical || !playlistId) throw new Error("Se necesita una playlist clásica guardada.");
      const record = await localRepo.get(playlistId);
      if (!record) throw new Error("No se encontró la playlist local. Comprueba que está migrada a IndexedDB.");
      await localRepo.update(playlistId, { works: next });
      setSavedWorks(next);
      return true;
    } catch (error) {
      showNotice("Error al guardar", String(error?.message || error), "warning");
      return false;
    }
  };

  const updateCardOverride = (index, changes) =>
    setCardOverrides((previous) => ({
      ...previous,
      [index]: { ...(previous[index] || {}), ...changes },
    }));
  // Plantillas de hoja A4, locales y vinculadas a esta playlist.
  const templateStorageKey = `shopp:music-card-sheet-templates:v1:${publicId}`;
  const [sheetTemplates, setSheetTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setTemplatesLoaded(false);
    AsyncStorage.getItem(templateStorageKey)
      .then(raw => {
        const value = raw ? JSON.parse(raw) : [];
        if (active) setSheetTemplates(Array.isArray(value) ? value.filter(t => t?.version === 1).slice(0, 20) : []);
      })
      .catch(error => { if (active) showNotice("Plantillas", `No se pudieron leer: ${error?.message || error}`, "warning"); })
      .finally(() => { if (active) setTemplatesLoaded(true); });
    return () => { active = false; };
  }, [templateStorageKey]);
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
  const updateGridStyle = (side, property, value) =>
    setGridStyles((previous) => ({
      ...previous,
      [side]: { ...previous[side], [property]: value },
    }));
  const changeGridWidth = (side, step) =>
    setGridStyles((previous) => {
      const current = previous[side].width;
      const index = GRID_WIDTH_OPTIONS.indexOf(current);
      const next =
        GRID_WIDTH_OPTIONS[
          Math.max(
            0,
            Math.min(
              GRID_WIDTH_OPTIONS.length - 1,
              (index >= 0 ? index : 1) + step,
            ),
          )
        ];
      return { ...previous, [side]: { ...previous[side], width: next } };
    });
  const [doubleSided, setDoubleSided] = useState(true);
  const [duplexFlip, setDuplexFlip] = useState("long");
  const [backOffsetX, setBackOffsetX] = useState(DEFAULT_BACK_OFFSET_X_MM);
  const [backOffsetY, setBackOffsetY] = useState(DEFAULT_BACK_OFFSET_Y_MM);
  const [backInsetEnabled, setBackInsetEnabled] = useState(true);
  const [backInsetMm, setBackInsetMm] = useState(DEFAULT_BACK_INSET_MM);
  const [backPanelToneId, setBackPanelToneId] = useState(
    DEFAULT_BACK_PANEL_TONE,
  );
  const [backFrameToneId, setBackFrameToneId] = useState(
    DEFAULT_BACK_FRAME_TONE,
  );
  const [frontToneId, setFrontToneId] = useState(DEFAULT_FRONT_TONE);
  const templateTrackSignature = () => validTracks.slice(0, 99)
    .map(t => videoIdFromTrack(t) || youtubePlaylistIdFromTrack(t) || "");
  const saveSheetTemplate = async () => {
    const name = templateName.trim();
    if (!name) { showNotice("Nombre requerido", "Escribe un nombre para esta plantilla.", "warning"); return; }
    if (!cardEntries.length) { showNotice("Hoja vacía", "Incluye alguna tarjeta antes de guardar.", "warning"); return; }
    const data = {
      version: 1, id: `${Date.now()}`, name, savedAt: new Date().toISOString(),
      trackSignature: templateTrackSignature(),
      cards: JSON.parse(JSON.stringify(cardOverrides)),
      selectedWorkIds: [...sheetWorkIds],
      settings: { cardMode, qrDestination, publicBaseUrl, title, author, single, subtitle,
        coverUri, format, copies, frontCropMarks, backCropMarks, showBackGridOnFront,
        gridStyles, doubleSided, duplexFlip, backOffsetX, backOffsetY,
        backInsetEnabled, backInsetMm, backPanelToneId, backFrameToneId, frontToneId,
        contactEmail, landingUrl },
    };
    const next = [data, ...sheetTemplates.filter(t => t.name !== name)].slice(0, 20);
    try {
      await AsyncStorage.setItem(templateStorageKey, JSON.stringify(next));
      setSheetTemplates(next);
      showNotice("Plantilla guardada", `«${name}» se ha guardado en este dispositivo.`);
    } catch (error) { showNotice("Error al guardar", String(error?.message || error), "warning"); }
  };
  // Intercambio portable. Nunca se importa código ni se cambian las pistas originales.
  const exportSheetTemplate = async (template) => {
    try {
      if (!template || template.version !== 1) throw new Error("Plantilla no válida.");
      const bundle = {
        schema: "shopp-music-card-sheet-template",
        version: 1,
        playlistPublicId: publicId,
        exportedAt: new Date().toISOString(),
        template,
      };
      const json = JSON.stringify(bundle, null, 2);
      const filename = `shopp-hoja-${String(template.name || "tarjetas").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 50)}.json`;
      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else {
        const FileSystem = await import("expo-file-system/legacy");
        const uri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
        if (!(await Sharing.isAvailableAsync())) throw new Error("Compartir archivos no está disponible.");
        await Sharing.shareAsync(uri, { mimeType: "application/json", UTI: "public.json" });
      }
    } catch (error) {
      showNotice("No se pudo exportar", String(error?.message || error), "warning");
    }
  };
  const importSheetTemplate = async () => {
    try {
      if (!templatesLoaded) return;
      const selection = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (selection.canceled || !selection.assets?.[0]) return;
      const file = selection.assets[0];
      if (file.size > 5_000_000) throw new Error("El archivo supera el límite de 5 MB.");
      let json;
      if (Platform.OS === "web" && file.file) json = await file.file.text();
      else {
        const FileSystem = await import("expo-file-system/legacy");
        json = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      }
      if (json.length > 5_000_000) throw new Error("El JSON es demasiado grande.");
      const bundle = JSON.parse(json);
      if (bundle?.schema !== "shopp-music-card-sheet-template" || bundle?.version !== 1)
        throw new Error("Formato de plantilla desconocido o versión no compatible.");
      if (bundle.playlistPublicId !== publicId)
        throw new Error("Esta plantilla pertenece a otra playlist. No se ha importado.");
      const t = bundle.template;
      if (!t || t.version !== 1 || typeof t.name !== "string" || !t.name.trim() || t.name.length > 120 ||
          !t.cards || typeof t.cards !== "object" || Array.isArray(t.cards) ||
          !t.settings || typeof t.settings !== "object" || Array.isArray(t.settings) ||
          !Array.isArray(t.trackSignature) || !Array.isArray(t.selectedWorkIds))
        throw new Error("Faltan datos obligatorios en la plantilla.");
      if (JSON.stringify(t.trackSignature) !== JSON.stringify(templateTrackSignature()))
        throw new Error("Las pistas de esta playlist no coinciden con las de la plantilla.");
      const imported = { ...t, id: `${Date.now()}`, name: t.name.trim(), savedAt: new Date().toISOString() };
      // Nunca sobrescribir silenciosamente una plantilla existente.
      const names = new Set(sheetTemplates.map(item => item.name));
      let name = imported.name, counter = 2;
      while (names.has(name)) name = `${imported.name} (importada ${counter++})`;
      imported.name = name;
      const next = [imported, ...sheetTemplates].slice(0, 20);
      await AsyncStorage.setItem(templateStorageKey, JSON.stringify(next));
      setSheetTemplates(next);
      setTemplateName(name);
      showNotice("Plantilla importada", `«${name}» guardada. Toca su nombre para recuperarla y verifica los QR antes de imprimir.`);
    } catch (error) {
      showNotice("Importación cancelada", String(error?.message || error), "warning");
    }
  };
  const loadSheetTemplate = (template) => {
    const oldSignature = template.trackSignature || [];
    if (JSON.stringify(oldSignature) !== JSON.stringify(templateTrackSignature())) {
      showNotice("Playlist modificada", "Las pistas o su orden han cambiado. Para evitar QR equivocados, no se ha cargado la plantilla.", "warning");
      return;
    }
    const c = template.cards;
    if (!c || typeof c !== "object" || Array.isArray(c)) return;
    const o = template.settings || {};
    setCardOverrides(c);
    setSheetWorkIds(Array.isArray(template.selectedWorkIds) ? template.selectedWorkIds : []);
    if (["playlist", "single", "songs"].includes(o.cardMode)) setCardMode(o.cardMode);
    if (typeof o.qrDestination === "string") setQrDestination(o.qrDestination);
    if (typeof o.publicBaseUrl === "string") setPublicBaseUrl(o.publicBaseUrl);
    if (typeof o.title === "string") setTitle(o.title);
    if (typeof o.author === "string") setAuthor(o.author);
    if (typeof o.single === "string") setSingle(o.single);
    if (typeof o.subtitle === "string") setSubtitle(o.subtitle);
    if (typeof o.coverUri === "string") setCoverUri(o.coverUri);
    if (typeof o.format === "string") setFormat(o.format);
    if (Number.isInteger(o.copies)) setCopies(o.copies);
    for (const [key, setter] of [
      ["frontCropMarks", setFrontCropMarks], ["backCropMarks", setBackCropMarks],
      ["showBackGridOnFront", setShowBackGridOnFront], ["doubleSided", setDoubleSided],
      ["backInsetEnabled", setBackInsetEnabled],
    ]) if (typeof o[key] === "boolean") setter(o[key]);
    if (o.gridStyles && typeof o.gridStyles === "object") setGridStyles(o.gridStyles);
    if (["long", "short"].includes(o.duplexFlip)) setDuplexFlip(o.duplexFlip);
    if (Number.isFinite(o.backOffsetX)) setBackOffsetX(o.backOffsetX);
    if (Number.isFinite(o.backOffsetY)) setBackOffsetY(o.backOffsetY);
    if (Number.isFinite(o.backInsetMm)) setBackInsetMm(o.backInsetMm);
    for (const [key, setter] of [
      ["backPanelToneId", setBackPanelToneId], ["backFrameToneId", setBackFrameToneId],
      ["frontToneId", setFrontToneId], ["contactEmail", setContactEmail],
      ["landingUrl", setLandingUrl],
    ]) if (typeof o[key] === "string") setter(o[key]);
    setTemplateName(template.name);
    setVerifiedSelections({});
    showNotice("Plantilla recuperada", `«${template.name}» cargada. Comprueba los enlaces QR públicos antes de imprimir.`);
  };
  const deleteSheetTemplate = async (id) => {
    const next = sheetTemplates.filter(t => t.id !== id);
    try {
      await AsyncStorage.setItem(templateStorageKey, JSON.stringify(next));
      setSheetTemplates(next);
    } catch (error) { showNotice("No se pudo eliminar", String(error?.message || error), "warning"); }
  };
  const previewInsetPx = backInsetEnabled
    ? (backInsetMm * previewCardWidth) / 90
    : 0;
  // Un cuadrado de 56 - 2*margen mm en una tarjeta de 90 x 56 mm.
  // Base fija en el eje horizontal: flex: 0 (sin base) colapsaba la carátula en web.
  const previewCoverSizePx = Math.max(
    0,
    previewCardHeight - 2 - 2 * previewInsetPx,
  );
  const previewQrSizePx =
    (Math.max(
      17.5,
      20.5 - Math.max(0, (backInsetEnabled ? backInsetMm : 0) - 4) * 0.5,
    ) *
      previewCardWidth) /
    90;
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
        if (!canceled)
          setCoverDimensions({ uri: coverUri, width: null, height: null });
      },
    );
    return () => {
      canceled = true;
    };
  }, [coverUri, coverDimensions?.uri]);
  const coverSizeLabel = !coverUri
    ? "Sin imagen seleccionada"
    : coverDimensions?.uri !== coverUri
      ? "Leyendo dimensiones…"
      : Number.isFinite(coverDimensions.width) &&
          Number.isFinite(coverDimensions.height)
        ? `${coverDimensions.width} × ${coverDimensions.height} px`
        : "Dimensiones no disponibles";
  const coverRenderScale = useMemo(
    () => getCoverOverscan(coverDimensions?.width, coverDimensions?.height),
    [coverDimensions?.width, coverDimensions?.height],
  );
  const [contactEmail, setContactEmail] = useState(DEFAULT_CONTACT_EMAIL);
  const [landingUrl, setLandingUrl] = useState(initialLandingUrl);
  const backPanelTone = useMemo(
    () => getBackPanelTone(backPanelToneId),
    [backPanelToneId],
  );
  const backFrameTone = useMemo(
    () => getBackFrameTone(backFrameToneId),
    [backFrameToneId],
  );
  const frontTone = useMemo(() => getFrontTone(frontToneId), [frontToneId]);

  const cardEntries = useMemo(() => {
    const origin = normalizePublicBase(publicBaseUrl);
    if (!origin) return [];
    if (cardMode === "playlist") {
      const first = validTracks[0];
      if (!first) return [];
      const url =
        qrDestination === "youtube"
          ? buildSongCardUrl(origin, first, title, author, "youtube")
          : buildPlaylistCardUrl(origin, publicId, qrDestination);
      if (!url) return [];
        return [{ title: single || title || "Playlist Shopp", author, subtitle, cover: coverUri, url }];
    }
    const pool = validTracks.slice(0, 1);
    return pool
      .slice(0, 99)
      .map((track, index) => {
        const settings = cardOverrides[index] || {};
        if (settings.enabled === false) return null;
        const parsed = splitAuthorAndSingle(track.title || "");
        const trackTitle =
          cardMode === "single"
            ? single || parsed.single
            : parsed.single || track.title;
        const trackAuthor =
          track.author || track.artist || parsed.author || author;
        const videoId = videoIdFromTrack(track);
        const personalCover = track.artworkUrl || track.cover || track.coverUrl || track.thumbnail;
        const youtubeCover = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
        const source = settings.image || "auto";
        const trackCover = typeof settings.customCover === "string" ? settings.customCover : source === "youtube"
          ? (youtubeCover || personalCover || coverUri)
          : source === "general"
            ? (coverUri || personalCover || youtubeCover)
            : source === "artwork"
              ? (personalCover || youtubeCover || coverUri)
              : (personalCover || youtubeCover || coverUri);
        const selectedIndices = Array.isArray(settings.trackIndices) && settings.trackIndices.length
          ? [...new Set(settings.trackIndices)].filter(i => Number.isInteger(i) && i >= 0 && i < validTracks.length).sort((a, b) => a - b)
          : [index];
        const multi = selectedIndices.length > 1;
        const groupId = settings.workPublicId || selectionCardId(publicId, selectedIndices);
        const url = multi
          ? buildPlaylistCardUrl(origin, groupId, qrDestination === "youtube" ? "landing" : qrDestination)
          : buildSongCardUrl(origin, track, trackTitle, trackAuthor, qrDestination);
        return {
          title: single || settings.title || trackTitle,
          subtitle,
          author,
          cover: coverUri || trackCover,
          url,
          trackIndices: selectedIndices,
          selectionPublicId: multi ? groupId : null,
          printOrder: Number.isInteger(settings.printOrder) ? settings.printOrder : index,
          sourceIndex: index,
        };
      })
      // No ocultar tarjetas sin URL: la comprobación previa debe informar del error.
      .filter(Boolean)
      .sort((a, b) => a.printOrder - b.printOrder);
  }, [
    validTracks,
    cardMode,
    qrDestination,
    publicBaseUrl,
    publicId,
    title,
    author,
    single,
    coverUri,
    subtitle,
    cardOverrides,
    customPlaylistReverses,
  ]);
  // Reordena exclusivamente las tarjetas activas, sin modificar las pistas ni sus QR.
  const movePrintedCard = (position, direction) => {
    const ordered = cardEntries.map(item => item.sourceIndex);
    const target = position + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[position], ordered[target]] = [ordered[target], ordered[position]];
    setCardOverrides(previous => {
      const next = { ...previous };
      ordered.forEach((index, printOrder) => {
        next[index] = { ...(next[index] || {}), printOrder };
      });
      return next;
    });
  };
  const openCardQrDestination = async (url) => {
    if (!/^https:\/\/[^\s]+$/i.test(String(url || ""))) {
      showNotice("QR inválido", "El destino de esta tarjeta no es una URL HTTPS válida.", "warning");
      return;
    }
    try { await Linking.openURL(url); }
    catch { showNotice("Enlace no disponible", "No se pudo abrir el destino del QR.", "warning"); }
  };
  const editableCards = useMemo(() => validTracks.slice(0, 99).map((track, index) => {
    const parsed = splitAuthorAndSingle(track.title || "");
    const settings = cardOverrides[index] || {};
    return {
      title: settings.title ?? (parsed.single || track.title || `Canción ${index + 1}`),
      author: settings.author ?? (track.author || track.artist || parsed.author || author),
      subtitle,
      image: settings.image || "auto",
      enabled: settings.enabled !== false,
      workPublicId: settings.workPublicId || null,
      trackIndices: Array.isArray(settings.trackIndices) && settings.trackIndices.length ? settings.trackIndices : [index],
    };
  }), [validTracks, cardOverrides, subtitle, author]);
  // Evita imprimir tarjetas adicionales para los movimientos que ya
  // pertenecen a la obra seleccionada. No se modifica la playlist original.
  const groupAsOneCard = () => {
    const selected = editableCards[selectedCardIndex];
    if (!selected || selected.trackIndices.length < 2) return;
    const groupedIndices = new Set(selected.trackIndices);
    setCardOverrides((previous) => {
      const next = { ...previous };
      for (const index of groupedIndices) {
        if (index === selectedCardIndex) continue;
        next[index] = { ...(next[index] || {}), enabled: false };
      }
      next[selectedCardIndex] = { ...(next[selectedCardIndex] || {}), enabled: true };
      return next;
    });
  };
  // Guarda una obra reutilizable; solo almacena referencias a los vídeos, no datos privados
  // ni imágenes base64. La playlist original permanece intacta.
  const saveSelectedWork = async () => {
    const selected = editableCards[selectedCardIndex];
    if (!worksLoaded || !selected || selected.trackIndices.length < 2) return;
    const trackKeys = selected.trackIndices.map(i => workTrackKey(validTracks[i]));
    if (trackKeys.some(key => !key)) {
      showNotice("Obra no guardada", "Hay pistas sin identificador de vídeo.", "warning");
      return;
    }
    const id = selectionCardId(publicId, selected.trackIndices);
    const work = {
      id,
      title: selected.title.trim() || "Obra sin título",
      subtitle: selected.subtitle,
      image: selected.image,
      composer: workMetadata.composer.trim(),
      conductor: workMetadata.conductor.trim(),
      orchestra: workMetadata.orchestra.trim(),
      soloist: workMetadata.soloist.trim(),
      trackKeys,
    };
    const next = [...savedWorks.filter(item => item.id !== id), work];
    if (await persistWorks(next)) showNotice("Obra guardada", "Obra guardada en la playlist; estará incluida en los respaldos JSON v2.", "success");
  };
  const applySavedWork = (work) => {
    const indices = matchWorkTrackIndices(work.trackKeys, validTracks);
    if (!indices || indices.length < 2) {
      showNotice("Obra no disponible", "No se encuentran todos sus movimientos en la playlist actual.", "warning");
      return;
    }
    const leader = indices[0];
    const groupedIndices = new Set(indices);
    setCardOverrides(previous => {
      const next = { ...previous };
      for (const i of groupedIndices) next[i] = { ...(next[i] || {}), enabled: i === leader };
      next[leader] = {
        ...(next[leader] || {}), enabled: true, title: work.title,
        subtitle: work.subtitle, image: work.image, trackIndices: indices,
        workPublicId: catalogWorkPublicId(playlist, work),
      };
      return next;
    });
    setSelectedCardIndex(leader);
    setWorkMetadata({ composer: work.composer || "", conductor: work.conductor || "", orchestra: work.orchestra || "", soloist: work.soloist || "" });
    showNotice("Obra recuperada", "Se ha preparado una tarjeta para la obra. Revisa y publica su QR antes de imprimir.", "success");
  };
  // Hoja de obras: cada elemento del catálogo ocupa UNA tarjeta, sin duplicar
  // los movimientos. Se respeta el orden elegido en la lista de selección.
  const prepareWorksSheet = () => {
    const chosen = sheetWorkIds.map(id => savedWorks.find(work => work.id === id)).filter(Boolean);
    if (!chosen.length || chosen.length > 10) {
      showNotice("Selección de obras", "Selecciona entre una y diez obras.", "warning");
      return;
    }
    const used = new Set();
    const next = {};
    for (const [position, work] of chosen.entries()) {
      const indices = matchWorkTrackIndices(work.trackKeys, validTracks);
      if (!indices?.length) {
        showNotice("Obra incompleta", `Faltan movimientos de «${work.title}».`, "warning");
        return;
      }
      if (indices.some(i => used.has(i))) {
        showNotice("Movimientos duplicados", `«${work.title}» comparte pistas con otra obra seleccionada. Revisa el catálogo.`, "warning");
        return;
      }
      indices.forEach(i => used.add(i));
      const leader = indices[0];
      next[leader] = {
        enabled: true, title: work.title, subtitle: work.subtitle || work.composer || "",
        image: work.image || "auto", trackIndices: indices, printOrder: position,
        workPublicId: catalogWorkPublicId(playlist, work),
      };
    }
    // Se desactivan las canciones individuales; solo se imprimen las obras escogidas.
    for (let i = 0; i < validTracks.length; i++) {
      if (!next[i]) next[i] = { enabled: false };
    }
    setCardOverrides(next);
    setSelectedCardIndex(chosen.length ? matchWorkTrackIndices(chosen[0].trackKeys, validTracks)[0] : 0);
    showNotice("Hoja preparada", `${chosen.length} obras, una tarjeta por obra. Comprueba y publica cada QR antes de imprimir.`, "success");
  };
  const toggleSheetWork = (id) => {
    setSheetWorkIds(previous => previous.includes(id)
      ? previous.filter(value => value !== id)
      : previous.length < 10 ? [...previous, id] : previous);
  };
  const deleteSavedWork = async (id) => {
    if (await persistWorks(savedWorks.filter(item => item.id !== id))) {
      showNotice("Obra eliminada", "Se ha quitado de las obras guardadas; no se han borrado pistas.", "success");
    }
  };
  const checkCardSelection = async () => {
    const selected = editableCards[selectedCardIndex];
    if (!selected || selected.trackIndices.length < 2 || checkingSelection) return;
    const id = selected.workPublicId || selectionCardId(publicId, selected.trackIndices);
    const url = getPublicManifestUrl(publicBaseUrl, id);
    if (!url) {
      showNotice("URL no válida", "Configura una URL pública HTTPS para Shopp.", "warning");
      return;
    }
    setCheckingSelection(true);
    try {
      const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      const expected = selected.trackIndices.map(i => videoIdFromTrack(validTracks[i]) || youtubePlaylistIdFromTrack(validTracks[i])).filter(Boolean);
      const actual = (manifest?.tracks || []).map(track => videoIdFromTrack(track) || youtubePlaylistIdFromTrack(track)).filter(Boolean);
      if (manifest?.schema !== "shopp-public-music-card" || manifest?.version !== 1 || manifest?.id !== id || actual.length !== expected.length || actual.some((trackId, i) => trackId !== expected[i])) {
        throw new Error("El JSON publicado no coincide con los movimientos seleccionados.");
      }
      setVerifiedSelections(previous => ({ ...previous, [id]: true }));
      showNotice("Selección publicada", "El manifiesto público contiene los movimientos seleccionados, en el orden previsto.", "success");
    } catch (error) {
      setVerifiedSelections(previous => ({ ...previous, [id]: false }));
      showNotice("Selección no verificada", `${error?.message || error}. Publica el ZIP en public/ y despliega Netlify antes de distribuir el QR.`, "warning");
    } finally {
      setCheckingSelection(false);
    }
  };
  const selectedSettings = editableCards[selectedCardIndex] || null;
  const selectedTrackIndices = selectedSettings?.trackIndices || [];
  const exportCardSelection = async () => {
    if (!selectedSettings || selectedTrackIndices.length < 2 || exportingSelection) return;
    const groupId = selectedSettings.workPublicId || selectionCardId(publicId, selectedTrackIndices);
    const grouped = selectedTrackIndices.map(i => validTracks[i]).filter(Boolean);
    if (grouped.length < 2) return;
    setExportingSelection(true);
    try {
      await savePublicMusicCardZip({
        ...playlist, title: selectedSettings.title || title,
        author: selectedSettings.subtitle || author,
        tracks: grouped,
      }, groupId, isClassical, false);
      showNotice("Selección exportada", "Descomprime el ZIP en public/ y publica Netlify antes de imprimir o distribuir el QR.", "success");
    } catch (error) {
      showNotice("Error al exportar", String(error?.message || error), "warning");
    } finally { setExportingSelection(false); }
  };
  // La vista previa sigue la tarjeta seleccionada en el editor.
  const previewEntry = cardEntries[0];
  const previewCoverUri = previewEntry?.cover || coverUri;
  const targetUrl = previewEntry?.url || "";
  // En iOS Chrome reconoce googlechromes://; Safari utiliza el enlace HTTPS normal.
  const openQrBrowser = async (browser) => {
    if (!/^https:\/\//i.test(targetUrl)) return;
    try {
      const chromeUrl =
        Platform.OS === "ios"
          ? targetUrl.replace(/^https:\/\//i, "googlechromes://")
          : targetUrl;
      const url = browser === "chrome" ? chromeUrl : targetUrl;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      // Si Chrome no está instalado, se abre la URL HTTPS con el navegador disponible.
      if (browser === "chrome") {
        try {
          await Linking.openURL(targetUrl);
        } catch (_) {}
      }
    }
  };
  const qrActionLabel = getQrActionLabel(qrDestination);

  const downloadPublicManifest = () => {
    if (Platform.OS !== "web") return;
    try {
      const manifest = buildPublicManifest(playlist, publicId, isClassical);
      const blob = new Blob([JSON.stringify(manifest, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${publicId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPublished(false);
      showNotice(
        "Ficha JSON descargada",
        `${publicId}.json\nCópiala a public/music-cards/ y despliega Netlify. Después pulsa «Comprobar publicación».`,
        "success",
      );
    } catch (error) {
      showNotice(
        "Error al descargar",
        error.message || "No se pudo crear la ficha pública.",
        "error",
      );
    }
  };

  const downloadPublicationZip = async () => {
    try {
      const result = await savePublicMusicCardZip(playlist, publicId, isClassical, includePublicLyrics);
      setPublished(false);
      showNotice(
        "ZIP de publicación preparado",
        `${result.filename}: JSON público y ${result.lyricsCount} letras LRC.${includePublicLyrics && !result.lyricsCount ? " No se encontraron letras LRC locales asociadas a estas canciones." : ""}\nExtrae music-cards/ en public/ del repositorio y despliega el proyecto completo en Netlify. Después comprueba la publicación.`,
        "success",
      );
    } catch (error) {
      showNotice("No se pudo exportar", error?.message || "Error al generar el ZIP público.", "error");
    }
  };

  const verifyPublicManifest = async () => {
    const url = getPublicManifestUrl(publicBaseUrl, publicId);
    if (!url) {
      showNotice(
        "URL no válida",
        "Indica una URL pública HTTPS válida.",
        "warning",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${url}?check=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(`Ficha no encontrada (HTTP ${response.status}).`);
      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();
      if (!contentType.includes("json"))
        throw new Error(
          "Netlify ha devuelto una página HTML en lugar de la ficha JSON. Copia el archivo descargado a public/music-cards/ y vuelve a desplegar.",
        );
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("La ficha publicada no contiene un JSON válido.");
      }
      const expected = buildPublicManifest(playlist, publicId, isClassical);
      const comparison = comparePublicPlaylist(expected, data);
      if (!comparison.ok)
        throw new Error(
          `${comparison.reason} Vuelve a exportar y desplegar la ficha.`,
        );
      // Evitar tarjetas impresas cuando el manifiesto apunta a LRC inexistentes.
      if (includePublicLyrics) {
        const expectedLyrics = validTracks.slice(0, 100)
          .filter(track => typeof track?.lyricsBackup?.text === "string" && track.lyricsBackup.text.trim()).length;
        const urls = (data.tracks || []).map(track => track.lyricsUrl).filter(Boolean);
        if (urls.length !== expectedLyrics) throw new Error("Las letras publicadas no coinciden con las seleccionadas para exportar.");
        for (const path of urls) {
          if (!/^\/music-cards\/lyrics\/shopp-[a-z0-9-]+\/\d{3}\.lrc$/.test(path)) throw new Error("URL LRC pública no válida.");
          const lrc = await fetch(new URL(path, url).toString(), { cache: "no-store" });
          if (!lrc.ok || (lrc.headers.get("content-type") || "").includes("text/html"))
            throw new Error(`No se pudo verificar la letra pública: ${path}`);
        }
      }
      setPublished(true);
      showNotice(
        "Publicación verificada",
        "La ficha pública coincide con la playlist. Puedes imprimir su código QR.",
        "success",
      );
    } catch (error) {
      setPublished(false);
      showNotice(
        "No se pudo comprobar la publicación",
        error?.message === "Failed to fetch" || error instanceof TypeError
          ? "No se pudo consultar Netlify. Comprueba la conexión y la dirección pública. Si el navegador indica CORS, revisa también la configuración del servidor."
          : error.message || "No se pudo comprobar la publicación.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const changeCopies = (delta) =>
    setCopies((value) => Math.max(1, Math.min(99, value + delta)));

  const pickCover = async (cardIndex = null) => {
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
    if (cardIndex !== null) updateCardOverride(cardIndex, { customCover: uri });
    else setCoverUri(uri);
  };

  // Fase 4J: validación integral, sin alterar HTML de impresión ni calibraciones.
  const [sheetCheck, setSheetCheck] = useState(null);
  const [checkingSheet, setCheckingSheet] = useState(false);
  const sheetInspection = useMemo(() => {
    const errors = [];
    const warnings = [];
    const active = cardEntries;
    const publicOrigin = normalizePublicBase(publicBaseUrl);
    if (!publicOrigin || !/^https:\/\//i.test(publicOrigin)) errors.push("La dirección pública de Shopp debe ser HTTPS.");
    if (!active.length) errors.push("No hay tarjetas válidas para imprimir.");
    if (active.some(c => !String(c.title || "").trim())) warnings.push("Hay tarjetas sin título impreso.");
    if (format === "a4" && active.length > 10)
      warnings.push(`Hay ${active.length} tarjetas: la salida ocupará varias hojas A4.`);
    active.forEach((card, i) => {
      const n = i + 1;
      if (!card.url || !/^https:\/\//i.test(card.url)) errors.push(`Tarjeta ${n}: el enlace QR no es HTTPS válido.`);
      if (!card.cover) warnings.push(`Tarjeta ${n}: no tiene carátula.`);
      if (card.trackIndices?.length > 1) {
        const indices = card.trackIndices;
        if (new Set(indices).size !== indices.length || indices.some(index => !validTracks[index])) errors.push(`Tarjeta ${n}: movimientos inexistentes o duplicados.`);
        if (!card.selectionPublicId) errors.push(`Tarjeta ${n}: falta identificador público de la obra.`);
      }
    });
    
    if (!doubleSided) warnings.push("La impresión a doble cara está desactivada.");
    return { errors, warnings, count: active.length,
      signature: JSON.stringify({ cards: active.map(c => [c.url, c.title, c.subtitle, c.cover, c.trackIndices, c.printOrder]),
        format, cardMode, doubleSided, backOffsetX, backOffsetY, duplexFlip, copies, backCropMarks, frontCropMarks }),
    };
  }, [cardEntries, publicBaseUrl, validTracks, format, cardMode, doubleSided,
    backOffsetX, backOffsetY, duplexFlip, copies, backCropMarks, frontCropMarks]);

  const verifyWholeSheet = async () => {
    if (checkingSheet) return;
    setCheckingSheet(true);
    const errors = [...sheetInspection.errors];
    const warnings = [...sheetInspection.warnings];
    const groups = cardEntries.filter(c => c.selectionPublicId);
    const checked = new Map();
    try {
      for (const card of groups) {
        const id = card.selectionPublicId;
        if (checked.has(id)) continue;
        const manifestUrl = getPublicManifestUrl(publicBaseUrl, id);
        if (!manifestUrl) { errors.push(`${card.title}: URL de manifiesto inválida.`); continue; }
        try {
          const response = await fetch(`${manifestUrl}${manifestUrl.includes("?") ? "&" : "?"}check=${Date.now()}`, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const manifest = await response.json();
          const expected = card.trackIndices.map(index => workTrackKey(validTracks[index]));
          const actual = (manifest?.tracks || []).map(track => workTrackKey(track));
          if (manifest?.schema !== "shopp-public-music-card" || manifest?.version !== 1 || manifest?.id !== id ||
              expected.length !== actual.length || expected.some((v, i) => v !== actual[i]))
            throw new Error("el JSON no coincide con los movimientos en el orden previsto");
          checked.set(id, true);
        } catch (error) {
          errors.push(`${card.title}: manifiesto no verificado (${error?.message || error}).`);
          checked.set(id, false);
        }
      }
      if (cardMode === "playlist" && qrDestination !== "youtube" && !published)
        errors.push("La playlist completa aún no está marcada como publicada y verificada.");
      const report = { errors, warnings, verified: checked.size, signature: sheetInspection.signature };
      setSheetCheck(report);
      showNotice(errors.length ? "Impresión bloqueada" : "Comprobación completada",
        errors.length ? `${errors.length} problema(s) que debes corregir antes de imprimir.` :
        `Sin errores bloqueantes. ${checked.size} manifiesto(s) de obra verificado(s), ${warnings.length} aviso(s).`,
        errors.length ? "warning" : "success");
    } finally { setCheckingSheet(false); }
  };

  // Fase 4K: registro portable para contrastar los QR impresos con los destinos digitales.
  // No incorpora datos privados de usuario ni letras; solo contenido visible en las tarjetas.
  const downloadSheetAudit = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      showNotice("Solo web", "Exporta el informe desde Shopp Web en tu Mac.", "warning");
      return;
    }
    const report = {
      schema: "shopp-print-sheet-audit",
      version: 1,
      createdAt: new Date().toISOString(),
      playlistTitle: title,
      format,
      cardMode,
      calibration: { backOffsetXmm: backOffsetX, backOffsetYmm: backOffsetY,
        doubleSided, duplexFlip, frontCropMarks, backCropMarks, showBackGridOnFront },
      inspection: { errors: sheetInspection.errors, warnings: sheetInspection.warnings,
        verified: sheetCheck?.signature === sheetInspection.signature && !sheetCheck.errors.length,
        verifiedPublicManifestCount: sheetCheck?.signature === sheetInspection.signature ? sheetCheck.verified : 0 },
      cards: cardEntries.map((card, index) => ({
        position: index + 1, title: card.title, subtitle: card.subtitle || "",
        trackIndices: card.trackIndices, selectionPublicId: card.selectionPublicId,
        qrUrl: card.url || "", imageUrl: /^https:\/\//i.test(card.cover || "") ? card.cover : null,
        embeddedImage: /^data:image\//i.test(card.cover || ""),
      })),
      manualChecks: [
        "Abrir cada qrUrl desde el iPhone sin instalar Shopp.",
        "Comprobar el orden y la reproducción de los movimientos de cada obra.",
        "Revisar miniaturas, QR y textos en vista previa antes de imprimir.",
        "Imprimir una hoja de prueba y verificar la coincidencia anverso/reverso tras recortar.",
      ],
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `shopp-comprobacion-tarjetas-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const print = () => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !targetUrl)
      return;
    if (cardMode === "playlist" && qrDestination !== "youtube" && !published) {
      showNotice(
        "Publicación pendiente",
        "Antes de imprimir, exporta la ficha JSON, publícala en Netlify y comprueba su URL.",
        "warning",
      );
      return;
    }
    if (sheetInspection.errors.length) {
      showNotice("Impresión bloqueada", sheetInspection.errors.join("\n"), "warning");
      return;
    }
    const currentGroups = cardEntries.some(card => card.selectionPublicId);
    if (currentGroups && (!sheetCheck || sheetCheck.signature !== sheetInspection.signature || sheetCheck.errors.length)) {
      showNotice("Verificación necesaria", "Pulsa «Verificar toda la hoja» antes de imprimir: se deben comprobar los manifiestos públicos de las obras seleccionadas.", "warning");
      return;
    }
    const html = buildPrintHtml({
      title,
      author,
      single,
      subtitle,
      cards: cardEntries,
      distinctCards: false,
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
      showNotice(
        "Ventana bloqueada",
        "Permite las ventanas emergentes para Shopp en tu navegador e inténtalo de nuevo.",
        "warning",
      );
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
          {GRID_COLOR_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`Color ${option.label}`}
              accessibilityState={{
                selected:
                  current.color.toLowerCase() === option.value.toLowerCase(),
              }}
              onPress={() => updateGridStyle(side, "color", option.value)}
              style={[
                styles.gridColorButton,
                current.color.toLowerCase() === option.value.toLowerCase() &&
                  styles.gridColorButtonActive,
              ]}
            >
              <View
                style={[styles.gridColorDot, { backgroundColor: option.value }]}
              />
            </Pressable>
          ))}
          <TextInput
            accessibilityLabel="Color hexadecimal de la cuadrícula"
            value={current.color}
            onChangeText={(value) =>
              updateGridStyle(side, "color", value.slice(0, 7))
            }
            placeholder="#555555"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            style={styles.gridHexInput}
          />
        </View>
        {!/^#[0-9a-f]{6}$/i.test(current.color) ? (
          <Text style={styles.gridInputHint}>
            Introduce un color hexadecimal completo (#RRGGBB). Se usará el color
            por defecto hasta que sea válido.
          </Text>
        ) : null}
        <View style={styles.gridWidthRow}>
          <Text style={styles.fieldLabel}>Espesor</Text>
          <View style={styles.gridWidthCounter}>
            <Pressable
              accessibilityLabel="Reducir espesor de línea"
              disabled={atWidthIndex <= 0}
              onPress={() => changeGridWidth(side, -1)}
              style={[
                styles.gridWidthButton,
                atWidthIndex <= 0 && styles.disabled,
              ]}
            >
              <Ionicons name="remove" size={16} color="#0f172a" />
            </Pressable>
            <Text style={styles.gridWidthValue}>
              {current.width.toFixed(2)} mm
            </Text>
            <Pressable
              accessibilityLabel="Aumentar espesor de línea"
              disabled={atWidthIndex >= GRID_WIDTH_OPTIONS.length - 1}
              onPress={() => changeGridWidth(side, 1)}
              style={[
                styles.gridWidthButton,
                atWidthIndex >= GRID_WIDTH_OPTIONS.length - 1 &&
                  styles.disabled,
              ]}
            >
              <Ionicons name="add" size={16} color="#0f172a" />
            </Pressable>
          </View>
        </View>
        <Text style={styles.fieldLabel}>Patrón</Text>
        <View style={styles.gridPatternsRow}>
          {GRID_PATTERN_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => updateGridStyle(side, "pattern", option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: current.pattern === option.id }}
              style={[
                styles.gridPatternButton,
                current.pattern === option.id && styles.gridPatternButtonActive,
              ]}
            >
              <View
                style={[
                  styles.gridPatternSample,
                  {
                    borderTopWidth: 2,
                    borderTopColor: style.color,
                    borderTopStyle: option.id,
                  },
                ]}
              />
              <Text
                style={[
                  styles.gridPatternLabel,
                  current.pattern === option.id &&
                    styles.gridPatternLabelActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.gridLinePreviewBox}>
          <Text style={styles.gridPreviewLabel}>Vista previa del trazo</Text>
          <View
            style={[
              styles.gridLinePreviewStroke,
              {
                borderTopWidth: Math.max(1, current.width * 10),
                borderTopColor: style.color,
                borderTopStyle: style.pattern,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pageIntro}>
          <View style={styles.pageTitleRow}>
            <View style={styles.pageIcon}>
              <Ionicons name="card-outline" size={23} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heading}>Tarjetas musicales</Text>
              <Text style={styles.help}>
                Diseña tarjetas de 90 × 56 mm con la imagen, el QR y los datos
                de Shopp.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.fields}>
          <View style={styles.formSection}>
            <View style={styles.sectionHeading}>
              <Ionicons name="albums-outline" size={21} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>
                  Contenido de las tarjetas
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Selecciona lo que quieres imprimir.
                </Text>
              </View>
            </View>
            <View style={styles.choicesGrid}>
              {[
                [
                  "songs",
                  "Primera canción",
                  "Un único reverso para las copias",
                  "musical-notes-outline",
                ],
                [
                  "single",
                  "Tema individual",
                  "Varias copias de un tema",
                  "disc-outline",
                ],
                [
                  "playlist",
                  "Playlist completa",
                  "Un QR para toda la lista",
                  "list-outline",
                ],
              ].map(([value, label, detail, icon]) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: cardMode === value }}
                  onPress={() => {
                    setCardMode(value);
                    setPublished(false);
                  }}
                  style={[
                    styles.choiceTile,
                    cardMode === value && styles.choiceTileActive,
                  ]}
                >
                  <View style={styles.choiceTop}>
                    <Ionicons
                      name={icon}
                      size={19}
                      color={cardMode === value ? "#1d4ed8" : "#64748b"}
                    />
                    <Ionicons
                      name={
                        cardMode === value
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={19}
                      color={cardMode === value ? "#2563eb" : "#94a3b8"}
                    />
                  </View>
                  <Text style={styles.choiceTitle}>{label}</Text>
                  <Text style={styles.choiceDescription}>{detail}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inlineHint}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#64748b"
              />
              <Text style={styles.inlineHintText}>
                {cardMode === "songs"
                  ? "Se imprimirá un único reverso con el QR de la primera canción."
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
                <Text style={styles.sectionSubtitle}>
                  Elige qué verá quien escanee la tarjeta.
                </Text>
              </View>
            </View>
            <View style={styles.choicesGrid}>
              {[
                [
                  "landing",
                  "Página Shopp",
                  "YouTube y reproductor público",
                  "globe-outline",
                ],
                [
                  "youtube",
                  "YouTube",
                  "Abrir la canción directamente",
                  "logo-youtube",
                ],
                [
                  "shopp",
                  "Reproductor Shopp",
                  "Abrir el reproductor público",
                  "play-circle-outline",
                ],
              ].map(([value, label, detail, icon]) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: qrDestination === value }}
                  onPress={() => {
                    setQrDestination(value);
                    setPublished(false);
                  }}
                  style={[
                    styles.choiceTile,
                    qrDestination === value && styles.choiceTileActive,
                  ]}
                >
                  <View style={styles.choiceTop}>
                    <Ionicons
                      name={icon}
                      size={19}
                      color={qrDestination === value ? "#1d4ed8" : "#64748b"}
                    />
                    <Ionicons
                      name={
                        qrDestination === value
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={19}
                      color={qrDestination === value ? "#2563eb" : "#94a3b8"}
                    />
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
                onChangeText={(value) => {
                  setPublicBaseUrl(value);
                  setPublished(false);
                }}
                style={styles.input}
                keyboardType="url"
                autoCapitalize="none"
                placeholder="https://mi-shopp.netlify.app"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.fieldHelp}>
                Para entregar tarjetas, utiliza la URL HTTPS publicada, no
                localhost.
              </Text>
            </View>
            {cardMode === "playlist" && qrDestination !== "youtube" ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>Publicar playlist antes de imprimir</Text>
                <Text style={styles.infoBoxText}>
                  El QR abrirá la playlist completa en Shopp, sin iniciar sesión.
                  Descargar archivos NO los publica automáticamente en Netlify.
                </Text>
                <View style={{ gap: 8, marginTop: 12 }}>
                  <Text style={{ color: "#334155", fontWeight: "700" }}>1 · Preparar archivos</Text>
                  <Text style={styles.infoBoxText}>
                    Genera un ZIP con music-cards/ y la ficha JSON. Las letras LRC son opcionales y solo deben difundirse con autorización.
                  </Text>
                  <Pressable
                    style={styles.secondaryButton}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: includePublicLyrics }}
                    onPress={() => { setIncludePublicLyrics(value => !value); setPublished(false); }}
                  >
                    <Ionicons name={includePublicLyrics ? "checkbox-outline" : "square-outline"} color="#2563eb" size={20} />
                    <Text style={styles.secondaryButtonText}>Incluir LRC autorizados</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={downloadPublicationZip}>
                    <Ionicons name="archive-outline" color="#2563eb" size={17} />
                    <Text style={styles.secondaryButtonText}>1. Descargar ZIP para Netlify</Text>
                  </Pressable>
                  <Text style={{ color: "#334155", fontWeight: "700", marginTop: 5 }}>2 · Publicar en Netlify</Text>
                  <Text style={styles.infoBoxText}>
                    Descomprime el ZIP y copia su carpeta music-cards/ dentro de public/ del proyecto, sin borrar otras playlists. Haz commit, push a develop y, si Netlify despliega main, fusiona la PR a main. Espera al despliegue completado.
                  </Text>
                  <Text style={styles.fieldHelp}>Archivo esperado: public/music-cards/{publicId}.json</Text>
                  <Text style={{ color: "#334155", fontWeight: "700", marginTop: 5 }}>3 · Comprobar antes de imprimir</Text>
                  <Text style={styles.infoBoxText}>
                    Compara el JSON publicado con la playlist actual. Esta comprobación no sube ningún archivo.
                  </Text>
                  <Pressable
                    style={[styles.secondaryButton, busy && styles.disabled]}
                    onPress={verifyPublicManifest}
                    disabled={busy}
                  >
                    <Ionicons name="checkmark-circle-outline" color="#2563eb" size={17} />
                    <Text style={styles.secondaryButtonText}>
                      {busy ? "Comprobando..." : "3. Comprobar publicación"}
                    </Text>
                  </Pressable>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Ionicons name={published ? "checkmark-circle" : "alert-circle-outline"} size={19} color={published ? "#15803d" : "#9a6700"} />
                    <Text style={{ color: published ? "#15803d" : "#854d0e", fontWeight: "700", flex: 1 }}>
                      {published ? "Publicación verificada: puedes imprimir" : "Pendiente de verificar: impresión bloqueada"}
                    </Text>
                  </View>
                  <Pressable style={styles.secondaryButton} onPress={downloadPublicManifest}>
                    <Ionicons name="document-text-outline" color="#2563eb" size={17} />
                    <Text style={styles.secondaryButtonText}>Avanzado: descargar solo JSON</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeading}>
              <Ionicons name="create-outline" size={21} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Textos e imágenes</Text>
                <Text style={styles.sectionSubtitle}>
                  Define los datos de la tarjeta y el contacto del anverso.
                </Text>
              </View>
            </View>
            <Text style={styles.subsectionTitle}>Datos básicos de la tarjeta</Text>
            <Text style={[styles.fieldHelp, { marginBottom: 12 }]}>Reverso único · Se repetirá en todas las copias impresas.</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Autor</Text>
                <TextInput value={author} onChangeText={setAuthor} style={styles.input}
                  placeholder="Alan Parsons Project" placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Single</Text>
                <TextInput value={single} onChangeText={setSingle} style={styles.input}
                  placeholder="Eye in the Sky" placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Subtítulo</Text>
                <TextInput value={subtitle} onChangeText={setSubtitle} style={styles.input}
                  placeholder="10 items" placeholderTextColor="#94a3b8" />
              </View>
            </View>
            <View style={styles.imagePickerRow}>
              <View style={styles.coverThumbnailBox}>
                {coverUri ? <Image source={{ uri: coverUri }} resizeMode="contain"
                  style={styles.coverThumbnail} accessibilityLabel="Carátula de la tarjeta" />
                  : <Ionicons name="image-outline" size={28} color="#94a3b8" />}
              </View>
              <View style={styles.coverDetails}>
                <Text style={styles.fieldLabel}>Carátula del single</Text>
                <Text style={styles.coverDimensions}>{coverSizeLabel}</Text>
                <Text style={styles.fieldHelp}>Imagen completa sin ampliar ni recortar sus textos.</Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable onPress={() => pickCover(null)} style={styles.secondaryButton}>
                  <Ionicons name="image-outline" size={17} color="#2563eb" />
                  <Text style={styles.secondaryButtonText}>{coverUri ? "Cambiar carátula" : "Elegir carátula"}</Text>
                </Pressable>
                {coverUri ? <Pressable onPress={() => { setCoverDimensions(null); setCoverUri(""); }} style={styles.removeCover}>
                  <Text style={styles.removeCoverText}>Quitar</Text>
                </Pressable> : null}
              </View>
            </View>
            <View style={styles.sectionDivider} />
            <Text style={styles.subsectionTitle}>Anverso · Contacto</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Correo electrónico</Text>
                <TextInput
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="info@ramshopp.com"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Página de Shopp</Text>
                <TextInput
                  value={landingUrl}
                  onChangeText={setLandingUrl}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://..."
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeading}>
              <Ionicons
                name="color-palette-outline"
                size={21}
                color="#2563eb"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Colores y acabado</Text>
                <Text style={styles.sectionSubtitle}>
                  Personaliza cada cara por separado.
                </Text>
              </View>
            </View>
            <Text style={styles.subsectionTitle}>Fondo del anverso</Text>
            <View style={styles.toneGrid}>
              {FRONT_TONES.map((tone) => (
                <Pressable
                  key={tone.id}
                  onPress={() => setFrontToneId(tone.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: frontToneId === tone.id }}
                  style={[
                    styles.toneChip,
                    frontToneId === tone.id && styles.toneChipActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toneSwatch,
                      { backgroundColor: tone.bg, overflow: "hidden" },
                    ]}
                  >
                    {tone.id === "original" && Platform.OS === "web" ? (
                      <Image
                        source={{ uri: FRONT_GRADIENT_PREVIEW_URI }}
                        style={styles.frontToneGradientSwatch}
                        resizeMode="stretch"
                      />
                    ) : tone.id === "transparent" ? (
                      <Image
                        source={{ uri: TRANSPARENT_SWATCH_URI }}
                        style={styles.frontToneGradientSwatch}
                        resizeMode="stretch"
                      />
                    ) : null}
                  </View>
                  <Text style={styles.toneLabel}>{tone.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sectionDivider} />
            <Text style={styles.subsectionTitle}>
              Marco y bandas laterales del reverso
            </Text>
            <Text style={styles.fieldHelp}>
              Marco exterior de 10 mm por defecto; la carátula se ajusta a un
              cuadrado, sin franjas laterales.
            </Text>
            <View style={styles.toneGrid}>
              {BACK_FRAME_TONES.map((tone) => (
                <Pressable
                  key={tone.id}
                  onPress={() => setBackFrameToneId(tone.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: backFrameToneId === tone.id }}
                  style={[
                    styles.toneChip,
                    backFrameToneId === tone.id && styles.toneChipActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toneSwatch,
                      { backgroundColor: tone.bg, overflow: "hidden" },
                    ]}
                  >
                    {tone.id === "transparent" ? (
                      <Image
                        source={{ uri: TRANSPARENT_SWATCH_URI }}
                        style={styles.frontToneGradientSwatch}
                        resizeMode="stretch"
                      />
                    ) : null}
                  </View>
                  <Text style={styles.toneLabel}>{tone.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sectionDivider} />
            <Text style={styles.subsectionTitle}>
              Panel derecho del reverso
            </Text>
            <View style={styles.toneGrid}>
              {BACK_PANEL_TONES.map((tone) => (
                <Pressable
                  key={tone.id}
                  onPress={() => setBackPanelToneId(tone.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: backPanelToneId === tone.id }}
                  style={[
                    styles.toneChip,
                    backPanelToneId === tone.id && styles.toneChipActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toneSwatch,
                      { backgroundColor: tone.bg, overflow: "hidden" },
                    ]}
                  >
                    {tone.id === "transparent" ? (
                      <Image
                        source={{ uri: TRANSPARENT_SWATCH_URI }}
                        style={styles.frontToneGradientSwatch}
                        resizeMode="stretch"
                      />
                    ) : null}
                  </View>
                  <Text style={styles.toneLabel}>{tone.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.toggleRow}
              onPress={() => setBackInsetEnabled((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: backInsetEnabled }}
            >
              <Ionicons
                name={backInsetEnabled ? "checkbox" : "square-outline"}
                size={23}
                color="#2563eb"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>
                  Margen de color en el reverso
                </Text>
                <Text style={styles.fieldHelp}>
                  Un marco del color elegido alrededor de la imagen y del panel
                  QR.
                </Text>
              </View>
            </Pressable>
            {backInsetEnabled ? (
              <View style={styles.compactControlRow}>
                <Text style={styles.fieldLabel}>Ancho del margen</Text>
                <View style={styles.counter}>
                  <Pressable
                    accessibilityLabel="Reducir margen"
                    onPress={() =>
                      setBackInsetMm((v) =>
                        nextBackInset(v, -CALIBRATION_STEP_MM),
                      )
                    }
                    style={styles.counterButton}
                  >
                    <Ionicons name="remove" size={18} color="#0f172a" />
                  </Pressable>
                  <Text style={styles.counterValue}>
                    {backInsetMm.toFixed(1)} mm
                  </Text>
                  <Pressable
                    accessibilityLabel="Aumentar margen"
                    onPress={() =>
                      setBackInsetMm((v) =>
                        nextBackInset(v, CALIBRATION_STEP_MM),
                      )
                    }
                    style={styles.counterButton}
                  >
                    <Ionicons name="add" size={18} color="#0f172a" />
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.inlineHint}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#64748b"
              />
              <Text style={styles.inlineHintText}>
                Transparente no aplica tinta de fondo. Las líneas de corte se
                configuran al imprimir.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.previewSection}>
          <View style={styles.sectionHeading}>
            <Ionicons name="eye-outline" size={21} color="#2563eb" />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>
                Vista previa de las tarjetas
              </Text>
              <Text style={styles.sectionSubtitle}>
                Así se verán las dos caras con los colores elegidos.
              </Text>
            </View>
          </View>
          <View style={styles.previewRow}>
            <View>
              <Text style={styles.sideLabel}>ANVERSO</Text>
              <View
                style={[
                  styles.card,
                  styles.shoppFrontCard,
                  {
                    width: previewCardWidth,
                    height: previewCardHeight,
                    backgroundColor: frontTone.bg,
                  },
                ]}
              >
                {frontTone.id === "original" && Platform.OS === "web" ? (
                  <Image
                    source={{ uri: FRONT_GRADIENT_PREVIEW_URI }}
                    style={styles.frontGradientPreview}
                    resizeMode="stretch"
                    pointerEvents="none"
                  />
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
          </View>
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
              <Text style={styles.sideLabel}>REVERSO ÚNICO</Text>
              <Text style={{ color: "#64748b", fontSize: 12 }}>1 diseño de tarjeta</Text>
            </View>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator
              contentContainerStyle={{ gap: 14, paddingVertical: 8, paddingHorizontal: 2 }}
              accessibilityLabel="Vista previa del reverso único">
              {cardEntries.slice(0, 1).map((entry, galleryIndex) => (
                <Pressable key={`reverse-preview-${entry.sourceIndex ?? galleryIndex}`}
                  onPress={() => {
                    if (Number.isInteger(entry.sourceIndex)) setSelectedCardIndex(entry.sourceIndex);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleccionar reverso ${galleryIndex + 1}: ${entry.title || "Tarjeta"}`}
                  style={{ width: previewCardWidth, gap: 5 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#475569" }}>
                      REVERSO
                    </Text>
                    {entry.sourceIndex === selectedCardIndex && cardEntries.length > 1 ? (
                      <Ionicons name="checkmark-circle" size={18} color="#2563eb" />
                    ) : null}
                  </View>
              <View
                style={[
                  styles.card,
                  styles.musicBackCard,
                  {
                    width: previewCardWidth,
                    height: previewCardHeight,
                    backgroundColor: backFrameTone.bg,
                    padding: previewInsetPx,
                  },
                ]}
              >
                <View style={styles.backInnerPreview}>
                  <View
                    style={[
                      styles.coverPanelPreview,
                      {
                        width: previewCoverSizePx,
                        minWidth: previewCoverSizePx,
                        flexBasis: previewCoverSizePx,
                        flexGrow: 0,
                        flexShrink: 0,
                        backgroundColor: backFrameTone.bg,
                      },
                    ]}
                  >
                    {(entry.cover || coverUri) ? (
                      <Image
                        source={{ uri: (entry.cover || coverUri) }}
                        resizeMode="contain"
                        style={[
                          styles.coverPreview,
                          { transform: [{ scale: coverRenderScale }] },
                        ]}
                      />
                    ) : (
                      <View style={[styles.coverPreview, styles.coverEmpty]}>
                        <Ionicons
                          name="disc-outline"
                          size={48}
                          color="#64748b"
                        />
                        <Text style={styles.coverEmptyText}>
                          Selecciona una carátula
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={[
                      styles.backInfoPreview,
                      { backgroundColor: backPanelTone.bg },
                      previewCompactBack && styles.backInfoCompactPreview,
                    ]}
                  >
                    <View style={styles.musicMetaPreview}>
                      {entry?.author ? (
                        <Text
                          style={[
                            styles.musicAuthor,
                            { color: backPanelTone.accent },
                            previewCompactBack && styles.musicAuthorCompact,
                          ]}
                          numberOfLines={1}
                        >
                          {entry.author}
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.musicTitle,
                          { color: backPanelTone.title },
                          previewCompactBack && styles.musicTitleCompact,
                        ]}
                        numberOfLines={2}
                      >
                        {entry?.title || single || title}
                      </Text>
                      {(entry?.subtitle ?? subtitle) ? (
                        <Text
                          style={[
                            styles.musicSubtitle,
                            { color: backPanelTone.meta },
                            previewCompactBack && styles.musicSubtitleCompact,
                          ]}
                          numberOfLines={1}
                        >
                          {entry?.subtitle ?? subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {entry.url ? (
                      <Pressable
                        onPress={(event) => {
                          // Evita que el clic sobre el QR seleccione también el reverso.
                          event?.stopPropagation?.();
                          openCardQrDestination(entry.url);
                        }}
                        accessibilityRole="link"
                        accessibilityLabel={`Abrir enlace del QR de la tarjeta ${galleryIndex + 1}: ${entry.title || "Tarjeta"}`}
                        accessibilityHint="Abre el destino público de este código QR en el navegador"
                        style={styles.qrPanelPreview}
                      >
                        <Image
                          source={{ uri: qrUrl(entry.url) }}
                          style={[
                            styles.qrBack,
                            { width: previewQrSizePx, height: previewQrSizePx },
                          ]}
                          resizeMode="contain"
                        />
                        <Text
                          style={[
                            styles.qrHint,
                            { color: backPanelTone.accent },
                            previewCompactBack && styles.qrHintCompact,
                          ]}
                        >
                          {qrActionLabel}
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={[styles.qrPanelPreview, styles.qrEmpty]}>
                        <Text>Sin enlace</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              Pulsa el QR para abrir y verificar su enlace. Los textos y la carátula se editan arriba.
            </Text>
          </View>
        </View>
        {targetUrl ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 12,
              marginBottom: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#475569", fontWeight: "600" }}>
              Probar enlace QR:
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => openQrBrowser("safari")}
              style={{
                borderWidth: 1,
                borderColor: "#93c5fd",
                borderRadius: 9,
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: "#eff6ff",
              }}
            >
              <Text style={{ color: "#1d4ed8", fontWeight: "700" }}>
                Abrir en Safari / navegador
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => openQrBrowser("chrome")}
              style={{
                borderWidth: 1,
                borderColor: "#93c5fd",
                borderRadius: 9,
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: "#eff6ff",
              }}
            >
              <Text style={{ color: "#1d4ed8", fontWeight: "700" }}>
                Abrir en Chrome
              </Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.note}>
          Texto impreso bajo el QR: «{qrActionLabel.replace("\n", " ")}». Para
          compartir playlists completas en otro dispositivo, publica antes su
          ficha JSON estática en Netlify.
        </Text>
        <Pressable
          disabled={
            !targetUrl ||
            Platform.OS !== "web" ||
            (cardMode === "playlist" &&
              qrDestination !== "youtube" &&
              !published)
          }
          onPress={() => {
            if (cardMode === "songs") {
              setSelectedCardIndex(0);
              setPrepareCardsOpen(true);
            } else setPrintOpen(true);
          }}
          style={[
            styles.button,
            (!targetUrl ||
              Platform.OS !== "web" ||
              (cardMode === "playlist" &&
                qrDestination !== "youtube" &&
                !published)) &&
              styles.disabled,
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

      {/* Paso previo: configurar el contenido de las tarjetas distintas. */}
      <Modal
        visible={prepareCardsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPrepareCardsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Preparar tarjetas</Text>
                <Text style={styles.modalHeaderHelp}>
                  {editableCards.filter((entry) => entry.enabled).length} tarjetas incluidas de {editableCards.length} posibles · Contenido del reverso
                </Text>
              </View>
              <Pressable onPress={() => setPrepareCardsOpen(false)} accessibilityLabel="Cerrar preparación" style={styles.modalClose}>
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              {isClassical && savedWorks.length > 0 ? (
                <View style={{ gap: 8, marginBottom: 16 }}>
                  <Text style={styles.modalSectionTitle}>Hoja A4 de obras completas</Text>
                  <Text style={styles.note}>Selecciona hasta diez obras en el orden deseado. Cada obra tendrá una tarjeta y un QR con sus movimientos. No se imprimirán tarjetas adicionales por movimiento.</Text>
                  {savedWorks.map(work => {
                    const indices = matchWorkTrackIndices(work.trackKeys, validTracks);
                    const checked = sheetWorkIds.includes(work.id);
                    return (
                      <Pressable key={`sheet-${work.id}`} disabled={!indices?.length}
                        onPress={() => toggleSheetWork(work.id)} style={styles.modalToggleRow}>
                        <Ionicons name={checked ? "checkbox" : "square-outline"} size={22}
                          color={indices?.length ? "#2563eb" : "#94a3b8"} />
                        <Text style={{ flex: 1, color: indices?.length ? "#0f172a" : "#94a3b8" }}>
                          {checked ? `${sheetWorkIds.indexOf(work.id) + 1}. ` : ""}{work.title} · {work.trackKeys.length} movimientos{indices?.length ? "" : " (incompleta)"}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable disabled={!sheetWorkIds.length} onPress={prepareWorksSheet}
                    style={[styles.previewButton, !sheetWorkIds.length && styles.disabled]}>
                    <Ionicons name="albums-outline" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Preparar hoja con {sheetWorkIds.length} obras</Text>
                  </Pressable>
                  <Text style={styles.note}>Antes de imprimir obras de varios movimientos, exporta y publica los manifiestos JSON, y verifica sus enlaces QR.</Text>
                </View>
              ) : null}
              <View style={{ gap: 8, marginBottom: 18 }}>
                <Text style={styles.modalSectionTitle}>Plantillas de hojas A4</Text>
                <Text style={styles.note}>Guarda las tarjetas, su orden, imagen y destino QR, además de los ajustes dúplex, guías y calibración. Solo en este dispositivo; no modifica las obras.</Text>
                <TextInput value={templateName} onChangeText={setTemplateName}
                  placeholder="Nombre de plantilla (p. ej. Beethoven - 10 obras)"
                  placeholderTextColor="#64748b"
                  style={styles.modalInput} accessibilityLabel="Nombre de plantilla" />
                <Pressable disabled={!templatesLoaded || !cardEntries.length} onPress={saveSheetTemplate}
                  style={[styles.previewButton, (!templatesLoaded || !cardEntries.length) && styles.disabled]}>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Guardar plantilla de hoja</Text>
                </Pressable>
                <Pressable disabled={!templatesLoaded} onPress={importSheetTemplate}
                  style={[styles.previewButton, !templatesLoaded && styles.disabled]}>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.buttonText}>Importar plantilla JSON</Text>
                </Pressable>
                {!templatesLoaded ? <Text style={styles.note}>Cargando plantillas…</Text> :
                  sheetTemplates.length ? sheetTemplates.map(template => (
                    <View key={template.id} style={[styles.modalToggleRow, { gap: 8 }]}>
                      <Pressable onPress={() => loadSheetTemplate(template)} style={{ flex: 1 }}>
                        <Text style={{ color: "#0f172a", fontWeight: "700" }}>{template.name}</Text>
                        <Text style={styles.note}>{template.savedAt?.slice(0, 10) || ""} · Tocar para recuperar</Text>
                      </Pressable>
                      <Pressable onPress={() => exportSheetTemplate(template)}
                        accessibilityLabel={`Exportar plantilla ${template.name} a JSON`} style={{ padding: 6 }}>
                        <Ionicons name="share-outline" size={20} color="#2563eb" />
                      </Pressable>
                      <Pressable onPress={() => deleteSheetTemplate(template.id)}
                        accessibilityLabel={`Eliminar plantilla ${template.name}`} style={{ padding: 6 }}>
                        <Ionicons name="trash-outline" size={20} color="#b91c1c" />
                      </Pressable>
                    </View>
                  )) : <Text style={styles.note}>Todavía no hay plantillas guardadas.</Text>}
              </View>
              <View style={{ gap: 9, marginBottom: 18 }}>
                <Text style={styles.modalSectionTitle}>Vista previa de la hoja · 2 × 5</Text>
                <Text style={styles.note}>Primeras 10 tarjetas, en orden de impresión. Usa las flechas para cambiar su posición; el QR permanece asociado a su obra o canción. Toca «Abrir QR» para comprobar el destino.</Text>
                {cardEntries.length === 0 ? <Text style={styles.note}>Selecciona al menos una tarjeta.</Text> : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {cardEntries.slice(0, 10).map((entry, position) => (
                    <View key={`sheet-preview-${entry.sourceIndex}`} style={{ width: "48%", borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 9, padding: 7, gap: 5, backgroundColor: "#fff" }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748b" }}>Posición {position + 1}</Text>
                      {entry.cover ? (
                        <Image source={{ uri: entry.cover }} resizeMode="contain" style={{ width: 74, height: 74, borderRadius: 5, alignSelf: "center", backgroundColor: "#e2e8f0" }} />
                      ) : <View style={{ width: 74, height: 74, backgroundColor: "#e2e8f0", alignSelf: "center", alignItems: "center", justifyContent: "center" }}><Ionicons name="image-outline" size={24} color="#64748b" /></View>}
                      <Text style={{ fontWeight: "700", fontSize: 12, color: "#0f172a" }} numberOfLines={2}>{entry.title}</Text>
                      <Text style={{ fontSize: 11, color: "#475569" }} numberOfLines={2}>{entry.subtitle || entry.author || "Sin subtítulo"}</Text>
                      <Text style={{ fontSize: 10, color: "#64748b" }}>{entry.trackIndices?.length > 1 ? `${entry.trackIndices.length} movimientos · QR de obra` : "1 pista · QR individual"}</Text>
                      <Pressable accessibilityLabel={`Abrir QR de ${entry.title}`} onPress={() => openCardQrDestination(entry.url)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="qr-code-outline" size={16} color="#2563eb" />
                        <Text style={{ color: "#2563eb", fontSize: 11, fontWeight: "700" }}>Abrir QR</Text>
                      </Pressable>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Pressable accessibilityLabel={`Mover ${entry.title} hacia arriba`} disabled={position === 0} onPress={() => movePrintedCard(position, -1)} style={{ padding: 5 }}><Ionicons name="arrow-back" size={20} color={position === 0 ? "#94a3b8" : "#2563eb"} /></Pressable>
                        <Pressable accessibilityLabel={`Editar ${entry.title}`} onPress={() => setSelectedCardIndex(entry.sourceIndex)} style={{ padding: 5 }}><Ionicons name="create-outline" size={20} color="#2563eb" /></Pressable>
                        <Pressable accessibilityLabel={`Mover ${entry.title} hacia abajo`} disabled={position === Math.min(cardEntries.length, 10) - 1} onPress={() => movePrintedCard(position, 1)} style={{ padding: 5 }}><Ionicons name="arrow-forward" size={20} color={position === Math.min(cardEntries.length, 10) - 1 ? "#94a3b8" : "#2563eb"} /></Pressable>
                      </View>
                    </View>
                  ))}
                </View>
                {cardEntries.length > 10 ? <Text style={styles.note}>Hay {cardEntries.length - 10} tarjetas adicionales en las siguientes hojas A4.</Text> : null}
                {cardEntries.some(entry => entry.trackIndices?.length > 1) ? <Text style={styles.note}>Importante: abrir un QR de obra no garantiza que esté publicado. Exporta y verifica su manifiesto antes de repartir las tarjetas.</Text> : null}
              </View>
              <Text style={styles.modalSectionTitle}>Obras del catálogo de la playlist</Text>
              <Text style={styles.note}>Guarda una selección de varios movimientos y recupérala en futuras impresiones. Se guardan dentro de la playlist clásica local y se incluyen en el respaldo JSON v2. No se modifican las pistas.</Text>
              {!worksLoaded ? <Text style={styles.note}>Cargando obras…</Text> : savedWorks.length ? savedWorks.map(work => {
                const available = Boolean(matchWorkTrackIndices(work.trackKeys, validTracks));
                return <View key={work.id} style={[styles.modalToggleRow, { gap: 8 }]}>
                  <Pressable disabled={!available} onPress={() => applySavedWork(work)} style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", color: available ? "#0f172a" : "#94a3b8" }}>{work.title}</Text>
                    <Text style={styles.note}>{[work.subtitle, work.composer, work.conductor, work.orchestra, work.soloist].filter(Boolean).join(" · ") || "Sin metadatos"} · {work.trackKeys.length} pistas{available ? "" : " · Faltan movimientos"}</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteSavedWork(work.id)} accessibilityLabel={`Eliminar obra ${work.title}`} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={20} color="#b91c1c" />
                  </Pressable>
                </View>;
              }) : <Text style={styles.note}>Todavía no hay obras guardadas para esta playlist.</Text>}
              <Text style={styles.modalSectionTitle}>Selecciona una canción u obra</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {editableCards.map((entry, index) => (
                  <Pressable
                    key={index}
                    onPress={() => setSelectedCardIndex(index)}
                    accessibilityLabel={`Editar tarjeta ${index + 1}: ${entry.title}`}
                    style={{ paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1.5, borderRadius: 9,
                      borderColor: selectedCardIndex === index ? "#2563eb" : "#cbd5e1",
                      backgroundColor: selectedCardIndex === index ? "#dbeafe" : "#fff" }}
                  >
                    <Text style={{ fontWeight: "700", color: entry.enabled ? "#0f172a" : "#94a3b8" }}>{index + 1}{entry.enabled ? "" : " ×"}</Text>
                  </Pressable>
                ))}
              </View>
              {selectedSettings ? (
                <View style={{ gap: 14, paddingTop: 8 }}>
                  <Text style={styles.modalSectionTitle}>Tarjeta {selectedCardIndex + 1}</Text>
                  <Pressable style={styles.modalToggleRow} onPress={() => updateCardOverride(selectedCardIndex, { enabled: !selectedSettings.enabled })}>
                    <Ionicons name={selectedSettings.enabled ? "checkbox" : "square-outline"} size={23} color="#2563eb" />
                    <Text style={styles.fieldLabel}>Incluir esta canción en la impresión</Text>
                  </Pressable>
                  <View>
                    <Text style={styles.fieldLabel}>Título</Text>
                    <TextInput style={styles.cardEditorInput} value={selectedSettings.title}
                      onChangeText={(value) => updateCardOverride(selectedCardIndex, { title: value })} />
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>Subtítulo</Text>
                    <TextInput style={styles.cardEditorInput} value={selectedSettings.subtitle}
                      placeholder="Artista, álbum o texto personalizado"
                      onChangeText={(value) => updateCardOverride(selectedCardIndex, { subtitle: value })} />
                  </View>
                  {selectedTrackIndices.length > 1 ? (
                    <View style={{ gap: 9 }}>
                      <Text style={styles.modalSectionTitle}>Ficha de la obra (opcional)</Text>
                      <Text style={styles.note}>Estos datos se guardan con la obra en este dispositivo. No modifican las canciones ni la disposición de impresión.</Text>
                      {[
                        ["composer", "Compositor", "Ludwig van Beethoven"],
                        ["conductor", "Director", "Nombre del director"],
                        ["orchestra", "Orquesta", "Nombre de la orquesta"],
                        ["soloist", "Solistas / intérpretes", "Nombre de los solistas"],
                      ].map(([field, label, placeholder]) => (
                        <View key={field}>
                          <Text style={styles.fieldLabel}>{label}</Text>
                          <TextInput
                            style={styles.cardEditorInput}
                            value={workMetadata[field]}
                            placeholder={placeholder}
                            onChangeText={(value) => setWorkMetadata(previous => ({ ...previous, [field]: value }))}
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.fieldLabel}>Pistas que reproducirá el QR ({selectedTrackIndices.length})</Text>
                  <Text style={styles.note}>Una pista: enlace original. Varias pistas: manifiesto público de la selección, que debes exportar y publicar.</Text>
                  {validTracks.map((track, trackIndex) => {
                    const included = selectedTrackIndices.includes(trackIndex);
                    return (
                      <Pressable key={`movement-${trackIndex}`} style={styles.modalToggleRow}
                        onPress={() => {
                          const next = included ? selectedTrackIndices.filter(i => i !== trackIndex) : [...selectedTrackIndices, trackIndex].sort((a,b)=>a-b);
                          if (next.length) updateCardOverride(selectedCardIndex, {trackIndices: next});
                        }}>
                        <Ionicons name={included ? "checkbox" : "square-outline"} size={21} color="#2563eb" />
                        <Text style={{ flex: 1, color: "#0f172a" }}>{trackIndex + 1}. {track.title || `Pista ${trackIndex+1}`}</Text>
                      </Pressable>
                    );
                  })}
                  {selectedTrackIndices.length > 1 ? (
                    <Pressable onPress={groupAsOneCard} style={styles.modalToggleRow}>
                      <Ionicons name="albums-outline" size={21} color="#2563eb" />
                      <Text style={{ flex: 1, color: "#0f172a", fontWeight: "700" }}>Una sola tarjeta para esta obra (excluir tarjetas de los otros movimientos)</Text>
                    </Pressable>
                  ) : null}
                  {selectedTrackIndices.length > 1 ? (
                    <Pressable onPress={saveSelectedWork} disabled={!worksLoaded} style={styles.modalToggleRow}>
                      <Ionicons name="save-outline" size={21} color="#2563eb" />
                      <Text style={{ flex: 1, color: "#0f172a", fontWeight: "700" }}>Guardar obra para futuras impresiones</Text>
                    </Pressable>
                  ) : null}
                  {selectedTrackIndices.length > 1 ? (
                    <Pressable onPress={exportCardSelection} disabled={exportingSelection} style={styles.previewButton}>
                      <Ionicons name="download-outline" size={18} color="#fff" />
                      <Text style={styles.buttonText}>{exportingSelection ? "Exportando…" : "Exportar QR y selección para Netlify"}</Text>
                    </Pressable>
                  ) : null}
                  {selectedTrackIndices.length > 1 ? (
                    <View style={{ gap: 7 }}>
                      <Pressable onPress={checkCardSelection} disabled={checkingSelection} style={styles.modalToggleRow}>
                        <Ionicons name="cloud-done-outline" size={21} color="#2563eb" />
                        <Text style={{ flex: 1, color: "#0f172a", fontWeight: "700" }}>{checkingSelection ? "Comprobando Netlify…" : "Verificar QR publicado"}</Text>
                      </Pressable>
                      <Text style={styles.note}>
                        {verifiedSelections[selectedSettings.workPublicId || selectionCardId(publicId, selectedTrackIndices)]
                          ? "✓ Selección pública comprobada. Si editas los movimientos, vuelve a exportar y verificar."
                          : "Pendiente de verificar. Antes de distribuir la tarjeta, exporta, publica y verifica el JSON de esta obra."}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.fieldLabel}>Fuente de imagen</Text>
                  {[
                    ["auto", "Automática (carátula propia, luego YouTube)"],
                    ["artwork", "Carátula de la canción"],
                    ["youtube", "Miniatura de YouTube"],
                    ["general", "Carátula general de la playlist"],
                  ].map(([value, label]) => (
                    <Pressable key={value} onPress={() => updateCardOverride(selectedCardIndex, { image: value })}
                      style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 6 }}>
                      <Ionicons name={selectedSettings.image === value ? "radio-button-on" : "radio-button-off"} size={21} color="#2563eb" />
                      <Text style={{ flex: 1, color: "#0f172a" }}>{label}</Text>
                    </Pressable>
                  ))}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Pressable disabled={selectedCardIndex === 0} onPress={() => setSelectedCardIndex((i) => i - 1)}>
                      <Text style={{ color: selectedCardIndex === 0 ? "#94a3b8" : "#2563eb", fontWeight: "700" }}>‹ Anterior</Text>
                    </Pressable>
                    <Pressable disabled={selectedCardIndex >= editableCards.length - 1} onPress={() => setSelectedCardIndex((i) => i + 1)}>
                      <Text style={{ color: selectedCardIndex >= editableCards.length - 1 ? "#94a3b8" : "#2563eb", fontWeight: "700" }}>Siguiente ›</Text>
                    </Pressable>
                  </View>
                </View>
              ) : <Text>No hay canciones con enlaces válidos para imprimir.</Text>}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPrepareCardsOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
              <Pressable disabled={!cardEntries.length} onPress={() => { setPrepareCardsOpen(false); setPrintOpen(true); }}
                style={[styles.previewButton, !cardEntries.length && styles.disabled]}>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
                <Text style={styles.buttonText}>Preparar impresión</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
                <Text style={styles.modalHeaderHelp}>
                  Formato, caras, corte y alineación.
                </Text>
              </View>
              <Pressable
                onPress={() => setPrintOpen(false)}
                accessibilityLabel="Cerrar impresión"
                style={styles.modalClose}
              >
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalSectionTitle}>1. Formato de papel</Text>
              <View style={styles.modalChoiceRow}>
                {[
                  ["a4", "Hoja A4", "Hasta 10 tarjetas", "grid-outline"],
                  ["card", "Tarjeta", "90 × 56 mm", "card-outline"],
                ].map(([value, label, detail, icon]) => (
                  <Pressable
                    key={value}
                    onPress={() => setFormat(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: format === value }}
                    style={[
                      styles.modalChoice,
                      format === value && styles.choiceTileActive,
                    ]}
                  >
                    <View style={styles.choiceTop}>
                      <Ionicons name={icon} size={19} color="#2563eb" />
                      <Ionicons
                        name={
                          format === value
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={18}
                        color="#2563eb"
                      />
                    </View>
                    <Text style={styles.choiceTitle}>{label}</Text>
                    <Text style={styles.choiceDescription}>{detail}</Text>
                  </Pressable>
                ))}
              </View>

              {format === "a4" ? (
                <View style={styles.modalFieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      Número de copias
                    </Text>
                    <Text style={styles.fieldHelp}>
                      Distribuidas en hojas de 10
                    </Text>
                  </View>
                  <View style={styles.counter}>
                    <Pressable
                      onPress={() => changeCopies(-1)}
                      style={[
                        styles.counterButton,
                        
                      ]}
                    >
                      <Ionicons name="remove" size={18} color="#0f172a" />
                    </Pressable>
                    <Text style={styles.counterValue}>
                      {copies}
                    </Text>
                    <Pressable
                      onPress={() => changeCopies(1)}
                      style={[
                        styles.counterButton,
                        
                      ]}
                    >
                      <Ionicons name="add" size={18} color="#0f172a" />
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.modalDivider} />
              <Text style={styles.modalSectionTitle}>
                2. Caras de impresión
              </Text>
              <Pressable
                onPress={() => setDoubleSided((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: doubleSided }}
                style={styles.modalToggleRow}
              >
                <Ionicons
                  name={doubleSided ? "checkbox" : "square-outline"}
                  size={23}
                  color="#2563eb"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>
                    Imprimir anverso y reverso
                  </Text>
                  <Text style={styles.fieldHelp}>
                    Genera ambas caras listas para impresión dúplex.
                  </Text>
                </View>
              </Pressable>
              {format === "a4" && doubleSided ? (
                <View style={styles.modalSubgroup}>
                  <Text style={styles.fieldLabel}>Volteo de la hoja</Text>
                  <View style={styles.segmentRow}>
                    {[
                      ["long", "Borde largo"],
                      ["short", "Borde corto"],
                    ].map(([value, label]) => (
                      <Pressable
                        key={value}
                        onPress={() => setDuplexFlip(value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: duplexFlip === value }}
                        style={[
                          styles.segmentOption,
                          duplexFlip === value && styles.segmentOptionActive,
                        ]}
                      >
                        <Ionicons
                          name={
                            duplexFlip === value
                              ? "radio-button-on"
                              : "radio-button-off"
                          }
                          size={17}
                          color="#2563eb"
                        />
                        <Text
                          style={[
                            styles.segmentText,
                            duplexFlip === value && styles.segmentTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {format === "a4" ? (
                <>
                  <View style={styles.modalDivider} />
                  <Text style={styles.modalSectionTitle}>
                    3. Líneas de corte y guías
                  </Text>
                  <Text style={styles.fieldHelp}>
                    Puedes activar cada cuadrícula y configurar su color,
                    espesor y patrón por separado.
                  </Text>
                  <View style={styles.modalSubgroup}>
                    <Pressable
                      onPress={() => setFrontCropMarks((v) => !v)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: frontCropMarks }}
                      style={styles.compactCheckRow}
                    >
                      <Ionicons
                        name={frontCropMarks ? "checkbox" : "square-outline"}
                        size={22}
                        color="#2563eb"
                      />
                      <Text style={styles.toggleLabel}>
                        Cuadrícula de corte en el anverso
                      </Text>
                    </Pressable>
                    {frontCropMarks ? renderGridStyleControls("front") : null}
                    {doubleSided ? (
                      <>
                        <Pressable
                          onPress={() => setBackCropMarks((v) => !v)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: backCropMarks }}
                          style={styles.compactCheckRow}
                        >
                          <Ionicons
                            name={backCropMarks ? "checkbox" : "square-outline"}
                            size={22}
                            color="#2563eb"
                          />
                          <Text style={styles.toggleLabel}>
                            Cuadrícula de corte en el reverso
                          </Text>
                        </Pressable>
                        {backCropMarks ? renderGridStyleControls("back") : null}
                      </>
                    ) : null}
                  </View>
                  {doubleSided ? (
                    <Pressable
                      onPress={() => setShowBackGridOnFront((v) => !v)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: showBackGridOnFront }}
                      style={styles.modalToggleRow}
                    >
                      <Ionicons
                        name={
                          showBackGridOnFront ? "checkbox" : "square-outline"
                        }
                        size={23}
                        color="#2563eb"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleLabel}>
                          Mostrar cuadrícula del reverso en el anverso
                        </Text>
                        <Text style={styles.fieldHelp}>
                          Guía (2 × 5) para comprobar la alineación. Respeta el
                          volteo y la calibración X/Y. Se imprime en el anverso.
                        </Text>
                      </View>
                    </Pressable>
                  ) : null}
                  {doubleSided && showBackGridOnFront
                    ? renderGridStyleControls("overlay")
                    : null}

                  {doubleSided ? (
                    <>
                      <View style={styles.modalDivider} />
                      <Text style={styles.modalSectionTitle}>
                        4. Calibración del reverso
                      </Text>
                      <Text style={styles.fieldHelp}>
                        Ajustes en pasos de 0,5 mm. Solo desplazan el reverso,
                        sin cambiar el tamaño de la hoja ni de las tarjetas.
                      </Text>
                      <View style={styles.calibrationRow}>
                        <Text style={styles.calibrationLabel}>
                          Horizontal (X)
                        </Text>
                        <Pressable
                          accessibilityLabel="Mover reverso 0,5 mm a la izquierda"
                          onPress={() =>
                            setBackOffsetX((v) =>
                              nextOffset(v, -CALIBRATION_STEP_MM),
                            )
                          }
                          style={styles.calibrationButton}
                        >
                          <Ionicons name="remove" size={18} color="#0f172a" />
                        </Pressable>
                        <Text style={styles.calibrationValue}>
                          {backOffsetX > 0 ? "+" : ""}
                          {backOffsetX.toFixed(1)} mm
                        </Text>
                        <Pressable
                          accessibilityLabel="Mover reverso 0,5 mm a la derecha"
                          onPress={() =>
                            setBackOffsetX((v) =>
                              nextOffset(v, CALIBRATION_STEP_MM),
                            )
                          }
                          style={styles.calibrationButton}
                        >
                          <Ionicons name="add" size={18} color="#0f172a" />
                        </Pressable>
                      </View>
                      <View style={styles.calibrationRow}>
                        <Text style={styles.calibrationLabel}>
                          Vertical (Y)
                        </Text>
                        <Pressable
                          accessibilityLabel="Subir reverso 0,5 mm"
                          onPress={() =>
                            setBackOffsetY((v) =>
                              nextOffset(v, -CALIBRATION_STEP_MM),
                            )
                          }
                          style={styles.calibrationButton}
                        >
                          <Ionicons name="remove" size={18} color="#0f172a" />
                        </Pressable>
                        <Text style={styles.calibrationValue}>
                          {backOffsetY > 0 ? "+" : ""}
                          {backOffsetY.toFixed(1)} mm
                        </Text>
                        <Pressable
                          accessibilityLabel="Bajar reverso 0,5 mm"
                          onPress={() =>
                            setBackOffsetY((v) =>
                              nextOffset(v, CALIBRATION_STEP_MM),
                            )
                          }
                          style={styles.calibrationButton}
                        >
                          <Ionicons name="add" size={18} color="#0f172a" />
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={() => {
                          setBackOffsetX(DEFAULT_BACK_OFFSET_X_MM);
                          setBackOffsetY(DEFAULT_BACK_OFFSET_Y_MM);
                        }}
                        style={styles.resetCalibration}
                      >
                        <Text style={styles.resetCalibrationText}>
                          Restablecer: X 0 mm · Y +2,5 mm
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                  <Text style={styles.capacity}>
                    Hoja A4: 2 columnas × 5 filas (10 tarjetas por página).
                  </Text>
                </>
              ) : null}
            </ScrollView>
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", gap: 6 }}>
              <Text style={{ fontWeight: "700", color: "#0f172a" }}>Comprobación previa de la hoja · {sheetInspection.count} tarjetas</Text>
              {sheetInspection.errors.map((message, i) => <Text key={`error-${i}`} style={{ color: "#b91c1c", fontSize: 12 }}>✖ {message}</Text>)}
              {sheetInspection.warnings.map((message, i) => <Text key={`warning-${i}`} style={{ color: "#92400e", fontSize: 12 }}>⚠ {message}</Text>)}
              {!sheetInspection.errors.length && <Text style={{ color: "#15803d", fontSize: 12 }}>✓ Enlaces y datos locales sin errores bloqueantes.</Text>}
              {sheetCheck?.signature === sheetInspection.signature && <Text style={{ color: sheetCheck.errors.length ? "#b91c1c" : "#15803d", fontSize: 12 }}>
                {sheetCheck.errors.length ? sheetCheck.errors.join(" · ") : `✓ ${sheetCheck.verified} manifiesto(s) público(s) comprobado(s).`}
              </Text>}
              {Platform.OS === "web" && <Pressable onPress={downloadSheetAudit} style={styles.modalToggleRow}>
                <Ionicons name="download-outline" size={18} color="#0f172a" />
                <Text style={{ color: "#0f172a", fontWeight: "700" }}>Descargar informe JSON de prueba</Text>
              </Pressable>}
              <Pressable onPress={verifyWholeSheet} disabled={checkingSheet} style={[styles.previewButton, checkingSheet && styles.disabled]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>{checkingSheet ? "Comprobando publicación…" : "Verificar toda la hoja"}</Text>
              </Pressable>
            </View>
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
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(notice)}
        transparent
        animationType="fade"
        onRequestClose={() => setNotice(null)}
      >
        <View style={styles.noticeBackdrop}>
          <View style={styles.noticeCard}>
            <View style={styles.noticeHeading}>
              <Ionicons
                name={
                  notice?.type === "success"
                    ? "checkmark-circle-outline"
                    : notice?.type === "error"
                      ? "alert-circle-outline"
                      : "information-circle-outline"
                }
                size={26}
                color={
                  notice?.type === "success"
                    ? "#16a34a"
                    : notice?.type === "error"
                      ? "#dc2626"
                      : "#2563eb"
                }
              />
              <Text style={styles.noticeTitle}>{notice?.title}</Text>
            </View>
            <Text style={styles.noticeMessage}>{notice?.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setNotice(null)}
              style={styles.noticeButton}
            >
              <Text style={styles.noticeButtonText}>Aceptar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  noticeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.48)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  noticeCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  noticeHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  noticeTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", flex: 1 },
  noticeMessage: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 23,
    marginBottom: 20,
  },
  noticeButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 9,
    alignSelf: "flex-end",
  },
  noticeButtonText: { color: "#fff", fontWeight: "700" },
  pageIntro: {
    width: "100%",
    maxWidth: 820,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  pageTitleRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  pageIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
  },
  formSection: {
    width: "100%",
    padding: 18,
    gap: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 3,
    lineHeight: 18,
  },
  subsectionTitle: { fontSize: 14, fontWeight: "700", color: "#334155" },
  sectionDivider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 3 },
  choicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  choiceTile: {
    flexBasis: 190,
    flexGrow: 1,
    minWidth: 180,
    minHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ed",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 5,
  },
  choiceTileActive: {
    borderColor: "#2563eb",
    borderWidth: 2,
    backgroundColor: "#eff6ff",
  },
  choiceTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  choiceTitle: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  choiceDescription: { fontSize: 11, lineHeight: 16, color: "#64748b" },
  inlineHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 10,
  },
  inlineHintText: { flex: 1, color: "#64748b", fontSize: 12, lineHeight: 17 },
  inputGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  inputField: { flex: 1, minWidth: 220, gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  fieldHelp: { fontSize: 11, color: "#64748b", lineHeight: 16 },
  infoBox: {
    gap: 10,
    padding: 13,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  infoBoxTitle: { color: "#334155", fontSize: 13, fontWeight: "700" },
  infoBoxText: { color: "#475569", fontSize: 12, lineHeight: 18 },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  imagePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    borderRadius: 9,
  },
  toggleLabel: { fontSize: 13, color: "#1e293b", fontWeight: "600" },
  compactControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  previewSection: {
    width: "100%",
    maxWidth: 820,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 18,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalHeaderHelp: { color: "#64748b", fontSize: 12 },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSectionTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  modalChoiceRow: { flexDirection: "row", gap: 9 },
  modalChoice: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ed",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 4,
  },
  modalFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  modalDivider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 4 },
  modalToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
  modalSubgroup: { gap: 10 },
  segmentRow: { flexDirection: "row", gap: 8 },
  segmentOption: {
    flex: 1,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  segmentOptionActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  segmentText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  segmentTextActive: { color: "#1d4ed8" },
  compactCheckRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    paddingVertical: 3,
  },
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
  coverPreview: { width: "100%", height: "100%", resizeMode: "contain" },
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
  musicMetaPreview: {
    width: "100%",
    alignItems: "center",
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    overflow: "hidden",
  },
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
  toneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  toneChipActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  toneSwatch: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,.10)",
  },
  toneLabel: { color: "#334155", fontSize: 13, fontWeight: "600" },
  frontGradientPreview: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
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
  cardEditorInput: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#0f172a", backgroundColor: "#fff", marginTop: 6 },
  modalScrollContent: { padding: 20, gap: 12, paddingBottom: 22 },
  gridStylePanel: {
    padding: 12,
    gap: 8,
    marginTop: 3,
    marginBottom: 8,
    marginLeft: 9,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ed",
  },
  gridStyleTitle: { fontSize: 13, fontWeight: "700", color: "#334155" },
  gridColorsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    alignItems: "center",
  },
  gridColorButton: {
    width: 31,
    height: 31,
    padding: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  gridColorButtonActive: {
    borderWidth: 2,
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  gridColorDot: { width: 20, height: 20, borderRadius: 5 },
  gridHexInput: {
    minWidth: 90,
    flexGrow: 1,
    flexBasis: 100,
    height: 34,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 7,
    backgroundColor: "#fff",
    fontSize: 13,
    color: "#0f172a",
  },
  gridInputHint: { color: "#b45309", fontSize: 11, lineHeight: 16 },
  gridWidthRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  gridWidthCounter: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  gridWidthButton: {
    width: 33,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  gridWidthValue: {
    width: 92,
    textAlign: "center",
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "700",
  },
  gridPatternsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  gridPatternButton: {
    flexGrow: 1,
    flexBasis: 108,
    minWidth: 95,
    paddingVertical: 8,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
  },
  gridPatternButtonActive: {
    borderWidth: 2,
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  gridPatternLabel: { fontSize: 11, color: "#475569", fontWeight: "600" },
  gridPatternLabelActive: { color: "#1d4ed8" },
  gridPatternSample: { width: "85%", height: 1 },
  gridLinePreviewBox: {
    gap: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 7,
    backgroundColor: "#fff",
  },
  gridPreviewLabel: { fontSize: 11, color: "#64748b" },
  gridLinePreviewStroke: { width: "100%", height: 1 },
  calibrationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },
  calibrationLabel: {
    width: 110,
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  calibrationValue: {
    minWidth: 74,
    textAlign: "center",
    color: "#0f172a",
    fontWeight: "700",
  },
  calibrationButton: {
    width: 36,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
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
  modalInput: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10, color: "#0f172a", backgroundColor: "#fff" },
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
