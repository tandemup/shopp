// Reader for the uncompressed ZIP archives emitted by playlistArchiveZip.js.
// Does not write to storage; the existing JSON v2 validator handles the payload.
function uint16(data, p) { return data[p] | (data[p + 1] << 8); }
function uint32(data, p) { return (data[p] | (data[p + 1] << 8) | (data[p + 2] << 16) | (data[p + 3] << 24)) >>> 0; }

// ZIP Store has two layers: playlist.json contains the portable LRCs, and
// lyrics/*.lrc are human-readable copies. Verify BOTH, not just the number
// of entries: a truncated or damaged external backup must never replace
// valid IndexedDB data.
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data) {
  let c = 0xFFFFFFFF;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function decodePlaylistArchive(buffer) {
  const data = new Uint8Array(buffer);
  if (data.length > MAX_ARCHIVE_BYTES) throw new Error("ZIP demasiado grande para importar en el navegador (128 MB).");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pos = 0;
  let jsonText = null;
  const lyricsFiles = [];
  const names = new Set();
  const localEntries = new Map();
  if (data.length < 30 || uint32(data, 0) !== 0x04034b50) {
    throw new Error("No es un archivo ZIP válido de Shopp.");
  }
  while (pos + 4 <= data.length && uint32(data, pos) === 0x04034b50) {
    if (pos + 30 > data.length) throw new Error("Archivo ZIP incompleto.");
    const flags = uint16(data, pos + 6);
    const method = uint16(data, pos + 8);
    const expectedCrc = uint32(data, pos + 14);
    const contentSize = uint32(data, pos + 18);
    const unpackedSize = uint32(data, pos + 22);
    const nameSize = uint16(data, pos + 26);
    const extraSize = uint16(data, pos + 28);
    if ((flags & ~0x0800) || method !== 0 || contentSize !== unpackedSize) {
      throw new Error("Este ZIP utiliza compresión u opciones no compatibles. Usa un ZIP exportado por Shopp.");
    }
    const nameStart = pos + 30;
    const contentStart = nameStart + nameSize + extraSize;
    const end = contentStart + contentSize;
    if (end > data.length || contentStart < nameStart) throw new Error("Archivo ZIP incompleto o dañado.");
    const name = decoder.decode(data.subarray(nameStart, nameStart + nameSize));
    if (names.has(name)) throw new Error("Archivo ZIP con nombres repetidos.");
    names.add(name);
    localEntries.set(name, { offset: pos, crc: expectedCrc, size: contentSize });
    const content = data.subarray(contentStart, end);
    if (crc32(content) !== expectedCrc) throw new Error(`ZIP dañado: el CRC no coincide en ${name}.`);
    if (name === "playlist.json") {
      if (jsonText !== null) throw new Error("El ZIP contiene varios playlist.json.");
      jsonText = decoder.decode(content);
    } else if (name.startsWith("lyrics/") && name.toLowerCase().endsWith(".lrc")) {
      lyricsFiles.push(decoder.decode(content));
    } else if (/^music-cards\/lyrics\/shopp-[a-z0-9-]{5,63}\/\d{3}\.lrc$/.test(name)) {
      // Recurso público opcional, no modifica la copia privada restaurada.
    } else if (/^music-cards\/shopp-[a-z0-9-]{5,63}\.json$/.test(name)) {
      // Ficha pública auxiliar: no sustituye al playlist.json privado.
      const manifest = JSON.parse(decoder.decode(content));
      if (manifest?.schema !== "shopp-public-music-card" || manifest?.version !== 1 ||
          !Array.isArray(manifest?.tracks) || !Array.isArray(manifest.tracks)) {
        throw new Error(`Ficha pública inválida: ${name}.`);
      }
    } else {
      throw new Error(`Archivo no reconocido dentro del ZIP: ${name.slice(0, 120)}.`);
    }
    pos = end;
  }
  // Confirm the ZIP central directory exists. All Shopp archives include it;
  // accepting local headers alone can import an interrupted download.
  if (pos + 4 > data.length || uint32(data, pos) !== 0x02014b50) {
    throw new Error("Archivo ZIP incompleto: falta el directorio central.");
  }
  const centralStart = pos;
  const centralNames = new Set();
  while (pos + 4 <= data.length && uint32(data, pos) === 0x02014b50) {
    if (pos + 46 > data.length) throw new Error("Directorio central ZIP incompleto.");
    const nameSize = uint16(data, pos + 28);
    const extraSize = uint16(data, pos + 30);
    const commentSize = uint16(data, pos + 32);
    const end = pos + 46 + nameSize + extraSize + commentSize;
    if (end > data.length) throw new Error("Directorio central ZIP incompleto.");
    const name = decoder.decode(data.subarray(pos + 46, pos + 46 + nameSize));
    const local = localEntries.get(name);
    if (!local || centralNames.has(name) || local.offset !== uint32(data, pos + 42) ||
        local.crc !== uint32(data, pos + 16) || local.size !== uint32(data, pos + 20) ||
        local.size !== uint32(data, pos + 24)) {
      throw new Error("El directorio central no coincide con el contenido del ZIP.");
    }
    centralNames.add(name);
    pos = end;
  }
  // Shopp emits no archive comment and no ZIP64 fields.
  if (pos + 22 !== data.length || uint32(data, pos) !== 0x06054b50 ||
      uint16(data, pos + 8) !== names.size || uint16(data, pos + 10) !== names.size ||
      centralNames.size !== names.size || uint32(data, pos + 12) !== pos - centralStart ||
      uint32(data, pos + 16) !== centralStart || uint16(data, pos + 20) !== 0) {
    throw new Error("Archivo ZIP incompleto o directorio central dañado.");
  }
  if (jsonText === null) throw new Error("El ZIP no contiene playlist.json.");
  const payload = JSON.parse(jsonText);
  if (payload?.version !== 2 || payload?.backupStatus !== "complete") {
    throw new Error("playlist.json no es una copia completa de playlists v2.");
  }
  const playlists = Array.isArray(payload.playlists) ? payload.playlists : [payload];
  const embeddedLyrics = playlists.flatMap(playlist => (playlist?.tracks || [])
    .filter(track => typeof track?.lyricsBackup?.text === "string")
    .map(track => track.lyricsBackup.text));
  if (Number(payload.lyricsEntries || 0) !== lyricsFiles.length ||
      embeddedLyrics.length !== lyricsFiles.length) {
    throw new Error("El número de archivos .lrc no coincide con playlist.json.");
  }
  for (let i = 0; i < lyricsFiles.length; i += 1) {
    if (lyricsFiles[i] !== embeddedLyrics[i]) {
      throw new Error(`La letra LRC ${i + 1} del ZIP no coincide con playlist.json.`);
    }
  }
  return payload;
}

export async function readPlaylistImportAsset(asset) {
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error("No se pudo leer el archivo seleccionado.");
  if (/\.zip$/i.test(String(asset.name || "")) || /zip/i.test(String(asset.mimeType || ""))) {
    return decodePlaylistArchive(await response.arrayBuffer());
  }
  return JSON.parse(await response.text());
}
