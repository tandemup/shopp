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

function youtubeUrl(track) {
  if (!track) return "";
  if (track.url) return String(track.url);
  if (track.playlistId)
    return `https://www.youtube.com/playlist?list=${track.playlistId}`;
  if (track.videoId) return `https://www.youtube.com/watch?v=${track.videoId}`;
  return "";
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

function buildPrintHtml({
  title,
  author,
  single,
  subtitle,
  targetUrl,
  format,
  copies,
  cropMarks,
  doubleSided,
  duplexFlip,
  coverUri,
  contactEmail,
  landingUrl,
}) {
  const q = qrUrl(targetUrl, 700);
  const safeTitle = esc(title);
  const safeAuthor = esc(author);
  const safeSingle = esc(single);
  const safeSubtitle = esc(subtitle);
  const safeCover = esc(coverUri);
  const safeEmail = esc(contactEmail);
  const safeLanding = esc(landingUrl);
  const isCard = format === "card";
  const count = isCard ? 1 : Math.max(1, Math.min(99, Number(copies) || 1));
  const perSheet = 10;

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

  // REVERSO: carátula del single + QR directo a YouTube.
  const back = () => `<div class="card-wrap"><div class="card back">
    <div class="cover-panel">${safeCover ? `<img class="cover" src="${safeCover}" alt="Carátula"/>` : `<div class="cover placeholder">Shopp Music</div>`}</div>
    <div class="back-info">
      <div class="music-meta">${safeAuthor ? `<span class="author">${safeAuthor}</span>` : ""}<strong>${safeSingle || safeTitle}</strong>${safeSubtitle ? `<span class="subtitle">${safeSubtitle}</span>` : ""}</div>
      <div class="qr-panel"><img src="${q}" alt="QR de YouTube"/><span>Escanea para escuchar en YouTube</span></div>
    </div>
  </div></div>`;

  const blank = () => `<div class="card-wrap blank"></div>`;
  const pages = [];
  for (let offset = 0; offset < count; offset += perSheet) {
    const slots = Array.from(
      { length: perSheet },
      (_, i) => offset + i < count,
    );
    const frontHtml = slots.map((used) => (used ? front() : blank())).join("");
    pages.push(`<div class="sheet front-sheet">${frontHtml}</div>`);

    if (doubleSided) {
      const backSlots = Array(perSheet).fill(false);
      slots.forEach((used, i) => {
        if (!used) return;
        const row = Math.floor(i / 2);
        const col = i % 2;
        const mapped =
          duplexFlip === "short" ? (4 - row) * 2 + col : row * 2 + (1 - col);
        backSlots[mapped] = true;
      });
      pages.push(
        `<div class="sheet back-sheet">${backSlots.map((used) => (used ? back() : blank())).join("")}</div>`,
      );
    }
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle || "Shopp"}</title><style>
    @page{size:${isCard ? "90mm 56mm" : "A4 portrait"};margin:${isCard ? "0" : "8.5mm 15mm"}}
    *{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{${isCard ? "width:90mm;height:56mm;" : "width:180mm;height:280mm;display:grid;grid-template-columns:90mm 90mm;grid-template-rows:repeat(5,56mm);gap:0;justify-content:center;align-content:start;"}}
    .sheet + .sheet{break-before:page;page-break-before:always}.card-wrap{position:relative;width:90mm;height:56mm;break-inside:avoid;page-break-inside:avoid}
    .card{width:90mm;height:56mm;${cropMarks && !isCard ? "border:.22mm solid #555;" : "border:.22mm solid #cbd5e1;"}background:#fff;overflow:hidden}
    .front{display:flex;align-items:center;padding:7mm;background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)}
    .shopp-mark{width:18mm;height:18mm;border-radius:5mm;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:25pt;font-weight:900;flex:0 0 18mm;margin-right:6mm}
    .front-copy{min-width:0;flex:1}.brand{font-size:15pt;color:#2563eb;font-weight:900;margin-bottom:1.5mm}.front h1{font-size:10.5pt;line-height:1.18;margin:0 0 1.5mm}.front-text{font-size:7.4pt;color:#64748b;margin:0 0 3mm}
    .contact{display:flex;align-items:baseline;gap:2mm;margin-top:1.2mm;min-width:0}.contact span{font-size:6.5pt;text-transform:uppercase;color:#64748b;font-weight:700;min-width:9mm}.contact strong{font-size:7.5pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .back{display:flex;background:#0f172a}.cover-panel{width:56mm;height:56mm;flex:0 0 56mm;background:#020617;display:flex;align-items:center;justify-content:center;overflow:hidden}.cover{width:100%;height:100%;display:block;object-fit:contain}.placeholder{display:flex;align-items:center;justify-content:center;background:#e2e8f0;color:#64748b;font-size:18pt;font-weight:700}.back-info{width:34mm;height:56mm;flex:0 0 34mm;padding:3mm 2.5mm;background:#0f172a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:hidden}
    .music-meta{width:100%;display:flex;flex-direction:column;gap:.8mm;text-align:center;min-width:0}.music-meta strong{font-size:9pt;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.music-meta span{font-size:6.5pt;line-height:1.15;color:#cbd5e1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.music-meta .author{font-size:7pt;font-weight:700;color:#93c5fd}.music-meta .subtitle{font-size:6pt;color:#94a3b8}
    .qr-panel{width:27mm;padding:1.5mm;border-radius:2mm;background:#fff;display:flex;flex-direction:column;align-items:center;gap:.8mm}.qr-panel img{display:block;width:22mm;height:22mm}.qr-panel span{font-size:5.6pt;line-height:1.1;text-align:center;color:#334155;font-weight:700}
    .blank{background:#fff}${cropMarks && !isCard ? ".blank{border:.22mm solid #555}" : ""}
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
  const targetUrl = useMemo(() => youtubeUrl(tracks[0]), [tracks]);
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
  const [cropMarks, setCropMarks] = useState(true);
  const [doubleSided, setDoubleSided] = useState(true);
  const [duplexFlip, setDuplexFlip] = useState("long");
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
    if (Platform.OS !== "web" || typeof window === "undefined" || !targetUrl)
      return;
    const html = buildPrintHtml({
      title,
      author,
      single,
      subtitle,
      targetUrl,
      format,
      copies,
      cropMarks,
      doubleSided,
      duplexFlip,
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
          reverso con la carátula y el QR directo a YouTube.
        </Text>
        <View style={styles.fields}>
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
            <View style={[styles.card, styles.musicBackCard]}>
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
              <View style={styles.backInfoPreview}>
                <View style={styles.musicMetaPreview}>
                  {author ? (
                    <Text style={styles.musicAuthor} numberOfLines={1}>
                      {author}
                    </Text>
                  ) : null}
                  <Text style={styles.musicTitle} numberOfLines={2}>
                    {single || title}
                  </Text>
                  {subtitle ? (
                    <Text style={styles.musicSubtitle} numberOfLines={1}>
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
                    <Text style={styles.qrHint}>
                      Escanea para escuchar en YouTube
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
        <Text style={styles.note}>
          El QR abre directamente la primera canción o playlist de YouTube. El
          email y la landing page del anverso pueden editarse antes de imprimir.
        </Text>
        <Pressable
          disabled={!targetUrl || Platform.OS !== "web"}
          onPress={() => setPrintOpen(true)}
          style={[
            styles.button,
            (!targetUrl || Platform.OS !== "web") && styles.disabled,
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
                <Text style={styles.modalLabel}>Número de copias</Text>
                <View style={styles.counter}>
                  <Pressable
                    onPress={() => changeCopies(-1)}
                    style={styles.counterButton}
                  >
                    <Ionicons name="remove" size={20} color="#0f172a" />
                  </Pressable>
                  <Text style={styles.counterValue}>{copies}</Text>
                  <Pressable
                    onPress={() => changeCopies(1)}
                    style={styles.counterButton}
                  >
                    <Ionicons name="add" size={20} color="#0f172a" />
                  </Pressable>
                </View>
                <Pressable
                  style={styles.optionRow}
                  onPress={() => setCropMarks((v) => !v)}
                >
                  <Ionicons
                    name={cropMarks ? "checkbox" : "square-outline"}
                    size={23}
                    color="#2563eb"
                  />
                  <Text style={styles.optionTitle}>
                    Líneas de corte para tijera
                  </Text>
                </Pressable>
                <Text style={styles.optionHelp}>
                  Dibuja una retícula continua de 90 × 56 mm para cortar
                  siguiendo líneas rectas.
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
  musicBackCard: { padding: 0, overflow: "hidden", backgroundColor: "#0f172a" },
  coverPanelPreview: {
    width: 212,
    height: 212,
    backgroundColor: "#020617",
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
    height: 212,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
  },
  musicMetaPreview: { width: "100%", alignItems: "center" },
  musicAuthor: {
    color: "#93c5fd",
    fontWeight: "700",
    fontSize: 10,
    marginBottom: 4,
    textAlign: "center",
  },
  musicTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  musicSubtitle: {
    color: "#cbd5e1",
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
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
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
