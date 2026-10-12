// P2P transfers are fully portable: YouTube references and LRC text only.
// Convex is used by the P2P screen to establish a peer connection, never here.
import { makePlaylistBackupV2 } from "@/src/services/playlistBackupV2";
import { validatePlaylistBackupV2 } from "@/src/services/playlistImportV2";
import { importPlaylistsLocally } from "@/src/services/playlistLocalImport";

export const P2P_PLAYLIST_CHUNK_CHARS = 12 * 1024;
export const P2P_PLAYLIST_MAX_BYTES = 8 * 1024 * 1024;
export const P2P_PLAYLIST_MAX_CHUNKS = 700;
const MAX_TRACKS = 100;
const utf8Length = value => new TextEncoder().encode(value).length;
const transferType = collection => collection === "classical"
  ? "shopp-classical-playlist" : "shopp-youtube-playlist";

export async function createPortableP2PPlaylist(playlist) {
  const collection = playlist?.collectionType;
  if (!["playlist", "classical"].includes(collection)) throw new Error("Tipo de playlist P2P inválido.");
  if (!Array.isArray(playlist.tracks) || playlist.tracks.length < 1 || playlist.tracks.length > MAX_TRACKS) {
    throw new Error(`Máximo ${MAX_TRACKS} items por playlist P2P.`);
  }
  // Reuse the local-only backup path. Missing advertised LRC aborts the transfer,
  // rather than silently losing a user's lyrics or downloading from Convex.
  const backup = await makePlaylistBackupV2([playlist], transferType(collection), { single: true, allowRemoteLyrics: false });
  const publicBackup = {
    app: "Shopp", version: 2, type: transferType(collection),
    exportedAt: backup.exportedAt, backupStatus: "complete",
    lyricsEntries: backup.lyricsEntries,
    title: backup.title, shareable: false, collectionType: collection,
    ...(collection === "classical" ? Object.fromEntries(
      ["composer", "performer", "conductor", "orchestra", "period", "year"]
        .map(key => [key, String(backup[key] || "")])) : {}),
    tracks: backup.tracks.map(track => ({
      kind: track.kind, title: track.title, url: track.url,
      ...(track.videoId ? { videoId: track.videoId } : {}),
      ...(track.playlistId ? { playlistId: track.playlistId } : {}),
      ...(track.lyricsBackup ? { lyricsBackup: {
        text: track.lyricsBackup.text,
        fileName: track.lyricsBackup.fileName,
        mimeType: "text/plain",
      } } : {}),
      lyricsDisabled: track.lyricsDisabled === true,
    })),
  };
  // Whitelist only portable fields, never IDs, keys or account metadata.
  validatePortableP2PPlaylist(publicBackup);
  assertTransferLength(JSON.stringify(publicBackup));
  return publicBackup;
}

export function assertTransferLength(json) {
  if (typeof json !== "string" || utf8Length(json) > P2P_PLAYLIST_MAX_BYTES) {
    throw new Error("La playlist P2P supera el máximo de 8 MB. Reduce la cantidad o tamaño de LRC.");
  }
}

export function splitPortableP2PPlaylist(payload) {
  const json = JSON.stringify(payload);
  assertTransferLength(json);
  const chunks = [];
  for (let i = 0; i < json.length;) {
    let end = Math.min(i + P2P_PLAYLIST_CHUNK_CHARS, json.length);
    // Do not split UTF-16 surrogate pairs: TextEncoder would replace
    // each half separately, corrupting accented/emoji LRC content.
    if (end < json.length && end > i &&
        json.charCodeAt(end - 1) >= 0xD800 && json.charCodeAt(end - 1) <= 0xDBFF &&
        json.charCodeAt(end) >= 0xDC00 && json.charCodeAt(end) <= 0xDFFF) end--;
    chunks.push(json.slice(i, end));
    i = end;
  }
  if (!chunks.length || chunks.length > P2P_PLAYLIST_MAX_CHUNKS) {
    throw new Error("La playlist P2P necesita demasiados fragmentos.");
  }
  return chunks;
}

export function validatePortableP2PPlaylist(payload) {
  if (!payload || payload.version !== 2 || !["shopp-youtube-playlist", "shopp-classical-playlist"].includes(payload.type)) {
    throw new Error("Formato de playlist P2P no reconocido.");
  }
  const collection = payload.type === "shopp-classical-playlist" ? "classical" : "playlist";
  // Existing v2 validation checks YouTube identifiers, LRC extension/size,
  // declared LRC count, completeness and collection type.
  const playlists = validatePlaylistBackupV2(payload, payload.type, { minimumTracks: 1, maximumTracks: MAX_TRACKS });
  if (playlists.length !== 1) throw new Error("La transferencia P2P debe contener una sola playlist.");
  return { collection, playlists };
}

export async function restorePortableP2PPlaylist(payload) {
  const { collection, playlists } = validatePortableP2PPlaylist(payload);
  return {
    collection, title: playlists[0].title, itemCount: playlists[0].tracks.length,
    result: await importPlaylistsLocally({ playlists, collection, replace: false }),
  };
}

// The inbox does not store full decoded datasets until all bounded chunks
// have arrived. A malformed or interrupted transfer cannot alter IndexedDB.
export function receivePortableP2PMessage(pending, message) {
  if (!["PLAYLIST_V2_START", "PLAYLIST_V2_CHUNK", "PLAYLIST_V2_END", "PLAYLIST_V2_CANCEL"].includes(message?.type)) {
    return { handled: false, payload: null };
  }
  const transferId = message.transferId;
  if (typeof transferId !== "string" || !/^[A-Za-z0-9_-]{1,90}$/.test(transferId)) {
    throw new Error("Identificador de transferencia P2P inválido.");
  }
  // Partial transfers can be abandoned if a peer disconnects unexpectedly.
  for (const [key, value] of pending) {
    if (Date.now() - value.startedAt > 2 * 60 * 1000) pending.delete(key);
  }
  if (message.type === "PLAYLIST_V2_CANCEL") {
    pending.delete(transferId);
    return { handled: true, payload: null };
  }
  if (message.type === "PLAYLIST_V2_START") {
    const total = message.totalChunks;
    if (!Number.isInteger(total) || total < 1 || total > P2P_PLAYLIST_MAX_CHUNKS || pending.size >= 3 || pending.has(transferId)) {
      throw new Error("Transferencia P2P demasiado grande o duplicada.");
    }
    pending.set(transferId, { total, chunks: Array(total).fill(null), chars: 0, startedAt: Date.now() });
    return { handled: true, payload: null };
  }
  const transfer = pending.get(transferId);
  if (!transfer) throw new Error("Fragmento P2P sin transferencia iniciada.");
  if (message.type === "PLAYLIST_V2_CHUNK") {
    const { index, chunk } = message;
    if (!Number.isInteger(index) || index < 0 || index >= transfer.total ||
        typeof chunk !== "string" || chunk.length > P2P_PLAYLIST_CHUNK_CHARS || transfer.chunks[index] !== null) {
      pending.delete(transferId);
      throw new Error("Fragmento de playlist P2P inválido o repetido.");
    }
    transfer.chars += chunk.length;
    if (transfer.chars > P2P_PLAYLIST_MAX_BYTES) {
      pending.delete(transferId);
      throw new Error("Playlist P2P demasiado grande.");
    }
    transfer.chunks[index] = chunk;
    return { handled: true, payload: null };
  }
  pending.delete(transferId);
  if (transfer.chunks.some(chunk => chunk === null)) throw new Error("Transferencia de playlist incompleta.");
  const json = transfer.chunks.join("");
  assertTransferLength(json);
  const payload = JSON.parse(json);
  validatePortableP2PPlaylist(payload);
  return { handled: true, payload };
}

export async function sendPortableP2PPlaylist(channel, playlist, sendJson, { waitForAck } = {}) {
  const portable = await createPortableP2PPlaylist(playlist);
  const chunks = splitPortableP2PPlaylist(portable);
  const transferId = globalThis.crypto?.randomUUID?.() || `p2p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (channel.readyState !== "open") throw new Error("Se perdió la conexión P2P.");
  // Register before START: a fast receiver can acknowledge before END returns.
  // Only updated peers pass a waiter; older tests and callers remain usable.
  const receipt = waitForAck?.(transferId);
  try {
    sendJson(channel, { type: "PLAYLIST_V2_START", transferId, totalChunks: chunks.length });
    for (let index = 0; index < chunks.length; index += 1) {
      // Safari has a limited WebRTC buffer: limit each frame and apply backpressure.
      let retries = 0;
      while (channel.bufferedAmount > 128 * 1024) {
        if (channel.readyState !== "open") throw new Error("Se perdió la conexión P2P.");
        if (retries++ >= 500) throw new Error("El receptor P2P no está aceptando datos.");
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      sendJson(channel, { type: "PLAYLIST_V2_CHUNK", transferId, index, chunk: chunks[index] });
      if (index % 8 === 7) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (channel.readyState !== "open") throw new Error("Se perdió la conexión P2P.");
    sendJson(channel, { type: "PLAYLIST_V2_END", transferId });
    if (receipt) await receipt.promise; // DataChannel.send alone is NOT delivery.
  } catch (error) {
    if (channel.readyState === "open") {
      try { sendJson(channel, { type: "PLAYLIST_V2_CANCEL", transferId }); } catch { /* link failed */ }
    }
    throw error;
  } finally {
    receipt?.cancel();
  }
}

// Track delivery receipts separately from the P2P payload. The remote peer
// sends ACK only AFTER its IndexedDB import commits. The tracker never sends
// metadata or content to Convex and is cleared when a connection closes.
export function createPlaylistAckTracker({ timeoutMs = 90_000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error("Timeout ACK no válido");
  const waiting = new Map();
  function register(transferId) {
    if (!/^[A-Za-z0-9_-]{1,90}$/.test(transferId) || waiting.has(transferId)) {
      throw new Error("Identificador ACK P2P repetido o inválido");
    }
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    // Keep rejections handled even if a send fails before awaiting this promise.
    void promise.catch(() => {});
    const timer = setTimeout(() => {
      waiting.delete(transferId);
      reject(new Error("No llegó confirmación de guardado P2P. Comprueba el otro dispositivo antes de reenviar."));
    }, timeoutMs);
    const entry = { resolve, reject, timer };
    waiting.set(transferId, entry);
    return {
      promise,
      cancel: () => { if (waiting.get(transferId) === entry) { clearTimeout(timer); waiting.delete(transferId); } },
    };
  }
  function accept(message) {
    if (message?.type !== "PLAYLIST_V2_ACK" ||
        typeof message.transferId !== "string") return false;
    const entry = waiting.get(message.transferId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    waiting.delete(message.transferId);
    if (message.ok === true && ["saved", "duplicate"].includes(message.status)) {
      entry.resolve({ status: message.status });
    } else {
      const reason = typeof message.error === "string" ? message.error.slice(0, 220) : "La importación IndexedDB falló";
      entry.reject(new Error(`El receptor no pudo guardar la playlist: ${reason}`));
    }
    return true;
  }
  function rejectAll() {
    for (const [id, entry] of waiting) {
      clearTimeout(entry.timer);
      entry.reject(new Error("La conexión P2P terminó antes de confirmar el guardado."));
      waiting.delete(id);
    }
  }
  return { register, accept, rejectAll, pendingCount: () => waiting.size };
}
