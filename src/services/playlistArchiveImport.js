// Reader for the uncompressed ZIP archives emitted by playlistArchiveZip.js.
// Does not write to storage; the existing JSON v2 validator handles the payload.
function uint16(data, p) { return data[p] | (data[p + 1] << 8); }
function uint32(data, p) { return (data[p] | (data[p + 1] << 8) | (data[p + 2] << 16) | (data[p + 3] << 24)) >>> 0; }

export function decodePlaylistArchive(buffer) {
  const data = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pos = 0;
  let jsonText = null;
  let lyricsFiles = 0;
  if (data.length < 30 || uint32(data, 0) !== 0x04034b50) {
    throw new Error("No es un archivo ZIP válido de Shopp.");
  }
  while (pos + 4 <= data.length && uint32(data, pos) === 0x04034b50) {
    if (pos + 30 > data.length) throw new Error("Archivo ZIP incompleto.");
    const flags = uint16(data, pos + 6);
    const method = uint16(data, pos + 8);
    const contentSize = uint32(data, pos + 18);
    const nameSize = uint16(data, pos + 26);
    const extraSize = uint16(data, pos + 28);
    if ((flags & 0x0008) || method !== 0) {
      throw new Error("Este ZIP utiliza compresión no compatible. Importa un ZIP exportado por Shopp o extrae playlist.json antes de importar.");
    }
    const nameStart = pos + 30;
    const contentStart = nameStart + nameSize + extraSize;
    const end = contentStart + contentSize;
    if (end > data.length) throw new Error("Archivo ZIP incompleto o dañado.");
    const name = decoder.decode(data.subarray(nameStart, nameStart + nameSize));
    if (name === "playlist.json") {
      if (jsonText !== null) throw new Error("El ZIP contiene varios playlist.json.");
      jsonText = decoder.decode(data.subarray(contentStart, end));
    } else if (name.startsWith("lyrics/") && name.toLowerCase().endsWith(".lrc")) {
      lyricsFiles += 1;
    }
    pos = end;
  }
  if (jsonText === null) throw new Error("El ZIP no contiene playlist.json.");
  const payload = JSON.parse(jsonText);
  if (payload?.version !== 2 || payload?.backupStatus !== "complete") {
    throw new Error("playlist.json no es una copia completa de playlists v2.");
  }
  if (Number(payload.lyricsEntries || 0) !== lyricsFiles) {
    throw new Error("El número de archivos .lrc no coincide con playlist.json.");
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
