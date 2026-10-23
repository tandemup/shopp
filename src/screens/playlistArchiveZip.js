// Portable, uncompressed ZIP of a complete Shopp JSON v2 backup and .lrc files.
// No external ZIP dependency; original IndexedDB/Convex data remains untouched.
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { getLocalLyrics } from "@/src/storage/lyricsStorage";
import { buildPublicManifest, publicIdForPlaylist, videoIdFromTrack, youtubePlaylistIdFromTrack } from "./musicCardLinks";

function safeName(name) {
  return (String(name || "lyrics")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 90) || "lyrics");
}
function bytes(value) { return value instanceof Uint8Array ? value : new TextEncoder().encode(value); }
function decodeCover(value) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(String(value || ""));
  if (!match) return null;
  const raw = match[2];
  if (raw.length > 2_800_000) return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out = [];
  let acc = 0, bits = 0;
  for (const character of raw.replace(/=+$/, "")) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return null;
    acc = (acc << 6) | digit; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >>> bits) & 255); }
  }
  return { content: Uint8Array.from(out), ext: match[1] === "jpeg" ? "jpg" : match[1] };
}
function addPublicCovers(entries, manifest, tracks, id) {
  tracks.forEach((track, index) => {
    const cover = decodeCover(track.artworkUrl || track.coverUrl);
    if (cover) {
      const file = `${String(index + 1).padStart(3, "0")}.${cover.ext}`;
      manifest.tracks[index].coverUrl = `/music-cards/covers/${id}/${file}`;
      entries.push([`music-cards/covers/${id}/${file}`, cover.content]);
    } else {
      const url = track.artworkUrl || track.coverUrl;
      if (/^https:\/\/[^\s]+$/i.test(url || "")) manifest.tracks[index].coverUrl = url;
    }
  });
}

function u16(out, offset, n) { out[offset] = n & 255; out[offset + 1] = (n >>> 8) & 255; }
function u32(out, offset, n) {
  out[offset] = n & 255; out[offset + 1] = (n >>> 8) & 255;
  out[offset + 2] = (n >>> 16) & 255; out[offset + 3] = (n >>> 24) & 255;
}
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data) {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function makeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [path, value] of entries) {
    const filename = bytes(path), content = bytes(value), crc = crc32(content);
    const local = new Uint8Array(30 + filename.length + content.length);
    u32(local, 0, 0x04034b50); u16(local, 4, 20); u16(local, 6, 0x0800);
    u32(local, 14, crc); u32(local, 18, content.length); u32(local, 22, content.length);
    u16(local, 26, filename.length); local.set(filename, 30);
    local.set(content, 30 + filename.length);
    const central = new Uint8Array(46 + filename.length);
    u32(central, 0, 0x02014b50); u16(central, 4, 20); u16(central, 6, 20);
    u16(central, 8, 0x0800); u32(central, 16, crc);
    u32(central, 20, content.length); u32(central, 24, content.length);
    u16(central, 28, filename.length); u32(central, 42, offset);
    central.set(filename, 46);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((n, e) => n + e.length, 0);
  const result = new Uint8Array(offset + centralSize + 22);
  let pos = 0;
  for (const segment of [...locals, ...centrals]) {
    result.set(segment, pos); pos += segment.length;
  }
  u32(result, pos, 0x06054b50); u16(result, pos + 8, entries.length);
  u16(result, pos + 10, entries.length); u32(result, pos + 12, centralSize);
  u32(result, pos + 16, offset);
  return result;
}
function asBase64(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < buffer.length; i += 3) {
    const a = buffer[i], b = buffer[i + 1], c = buffer[i + 2];
    result += alphabet[a >>> 2] + alphabet[((a & 3) << 4) | ((b || 0) >>> 4)] +
      (i + 1 < buffer.length ? alphabet[((b & 15) << 2) | ((c || 0) >>> 6)] : "=") +
      (i + 2 < buffer.length ? alphabet[c & 63] : "=");
  }
  return result;
}

export function makePlaylistArchive(backup) {
  if (backup?.version !== 2 || backup?.backupStatus !== "complete") {
    throw new Error("Se necesita una copia JSON v2 completa.");
  }
  const playlists = Array.isArray(backup.playlists) ? backup.playlists : [backup];
  const entries = [["playlist.json", JSON.stringify(backup, null, 2)]];
  // Fichas públicas listas para copiar a public/music-cards/ en Netlify.
  // Se generan exclusivamente a partir de las pistas del JSON de respaldo.
  // No incluyen letras, IDs de usuario ni metadatos internos.
  const isClassical = /classical|classic/i.test(String(backup.type || ""));
  const isMusic = /music|youtube-playlist|classical|classic/i.test(String(backup.type || ""));
  if (isMusic) {
    for (const playlist of playlists) {
      const playable = (playlist?.tracks || []).some(t => videoIdFromTrack(t) || youtubePlaylistIdFromTrack(t));
      if (!playable) continue; // El respaldo debe funcionar incluso sin vídeos publicables.
      const id = publicIdForPlaylist(playlist);
      const manifest = buildPublicManifest(playlist, id, isClassical);
      // La parte pública del ZIP es opcional de desplegar: los LRC son texto
      // potencialmente protegido por derechos. Publícalos solo con autorización.
      const playableTracks = (playlist.tracks || []).filter(t => videoIdFromTrack(t) || youtubePlaylistIdFromTrack(t)).slice(0, 100);
      addPublicCovers(entries, manifest, playableTracks, id);
      playableTracks.forEach((track, index) => {
        if (typeof track?.lyricsBackup?.text !== "string" || !track.lyricsBackup.text.trim()) return;
        const filename = `${String(index + 1).padStart(3, "0")}.lrc`;
        const url = `/music-cards/lyrics/${id}/${filename}`;
        manifest.tracks[index].lyricsUrl = url;
        entries.push([`music-cards/lyrics/${id}/${filename}`, track.lyricsBackup.text]);
      });
      entries.push([`music-cards/${id}.json`, JSON.stringify(manifest, null, 2)]);
    }
  }
  const used = new Set();
  let count = 0;
  for (const [pIndex, playlist] of playlists.entries()) {
    for (const [tIndex, track] of (playlist.tracks || []).entries()) {
      const lrc = track.lyricsBackup;
      if (!lrc || typeof lrc.text !== "string") continue;
      const requested = safeName(lrc.fileName || track.lyricsFileName || track.title);
      const filename = requested.toLowerCase().endsWith(".lrc") ? requested : `${requested}.lrc`;
      const prefix = `${String(pIndex + 1).padStart(3, "0")}-${safeName(playlist.title)}_`;
      const unique = `${prefix}${String(tIndex + 1).padStart(3, "0")}-${filename}`;
      let path = `lyrics/${unique}`;
      let suffix = 2;
      while (used.has(path)) path = `lyrics/${suffix++}-${unique}`;
      used.add(path);
      entries.push([path, lrc.text]);
      count += 1;
    }
  }
  if (count !== backup.lyricsEntries) {
    throw new Error("El número de letras LRC no coincide con el respaldo. No se exportará una copia incompleta.");
  }
  return { buffer: makeZip(entries), lyricsCount: count };
}

export async function savePlaylistArchive(backup, filename) {
  const { buffer, lyricsCount } = makePlaylistArchive(backup);
  const name = `${String(filename || "playlist").replace(/\.(json|zip)$/i, "")}.zip`;
  if (Platform.OS === "web") {
    const blob = new Blob([buffer], { type: "application/zip" });
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: "Archivo ZIP", accept: { "application/zip": [".zip"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob); await writable.close();
        return { filename: name, lyricsCount };
      } catch (error) {
        if (error?.name === "AbortError") return { filename: null, lyricsCount: 0, cancelled: true };
      }
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = name;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } else {
    const FileSystem = await import("expo-file-system/legacy");
    const uri = `${FileSystem.cacheDirectory}${name}`;
    await FileSystem.writeAsStringAsync(uri, asBase64(buffer), {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!(await Sharing.isAvailableAsync())) throw new Error("No se puede compartir este ZIP en el dispositivo.");
    await Sharing.shareAsync(uri, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: name });
  }
  return { filename: name, lyricsCount };
}


// Paquete público independiente de los respaldos privados: no incorpora
// playlist.json, correos, IDs internos, ni LRC sin autorización explícita.
export function makePublicMusicCardZip(playlist, publicId, isClassical = false, includeLyrics = false) {
  const manifest = buildPublicManifest(playlist, publicId, isClassical);
  const entries = [];
  const tracks = (Array.isArray(playlist?.tracks) ? playlist.tracks : [])
    .filter(t => videoIdFromTrack(t) || youtubePlaylistIdFromTrack(t)).slice(0, 100);
  addPublicCovers(entries, manifest, tracks, publicId);
  let lyricsCount = 0;
  if (includeLyrics) {
    tracks.forEach((track, index) => {
      const lrc = track?.lyricsBackup?.text;
      if (typeof lrc !== "string" || !lrc.trim()) return;
      const file = `${String(index + 1).padStart(3, "0")}.lrc`;
      manifest.tracks[index].lyricsUrl = `/music-cards/lyrics/${publicId}/${file}`;
      entries.push([`music-cards/lyrics/${publicId}/${file}`, lrc]);
      lyricsCount++;
    });
  }
  entries.unshift([`music-cards/${publicId}.json`, JSON.stringify(manifest, null, 2)]);
  entries.push(["INSTRUCCIONES_PUBLICACION.txt", `SHopp - publicación pública\n\nCopia la carpeta music-cards/ de este ZIP dentro de public/ del repositorio Shopp.\nPublica el proyecto completo en Netlify, sin reemplazar el sitio por este ZIP.\nComprueba la publicación desde Imprimir tarjeta antes de imprimir.\nLos archivos LRC se publican como texto accesible por URL; asegúrate de disponer de derechos.\n`]);
  return { buffer: makeZip(entries), lyricsCount, manifest };
}

export async function savePublicMusicCardZip(playlist, publicId, isClassical, includeLyrics) {
  // El reproductor almacena los LRC en IndexedDB / almacenamiento local.
  // La playlist activa suele contener solo la referencia, no lyricsBackup.text.
  // Recuperamos las letras ANTES de generar el ZIP, sin modificar la playlist original.
  let source = playlist;
  if (includeLyrics) {
    const tracks = await Promise.all((playlist?.tracks || []).map(async (track) => {
      if (track?.lyricsDisabled === true) return { ...track, lyricsBackup: undefined };
      if (typeof track?.lyricsBackup?.text === "string" && track.lyricsBackup.text.trim()) return track;
      const local = await getLocalLyrics(track);
      if (typeof local?.text === "string" && local.text.trim()) {
        return { ...track, lyricsBackup: { text: local.text, fileName: local.fileName || track.lyricsFileName || "lyrics.lrc" } };
      }
      if (track?.lyricsFileName || track?.lyricsStorageId || track?.lyricsSize) {
        throw new Error(`No se encontró el LRC local de «${track.title || "canción"}». Abre la playlist en este dispositivo, recupera sus letras e inténtalo de nuevo.`);
      }
      return track;
    }));
    source = { ...playlist, tracks };
  }
  const { buffer, lyricsCount } = makePublicMusicCardZip(source, publicId, isClassical, includeLyrics);
  const name = `${publicId}-netlify.zip`;
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } else {
    const FileSystem = await import("expo-file-system/legacy");
    const uri = `${FileSystem.cacheDirectory}${name}`;
    await FileSystem.writeAsStringAsync(uri, asBase64(buffer), { encoding: FileSystem.EncodingType.Base64 });
    if (!(await Sharing.isAvailableAsync())) throw new Error("No se puede compartir el ZIP en este dispositivo.");
    await Sharing.shareAsync(uri, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: name });
  }
  return { filename: name, lyricsCount };
}
