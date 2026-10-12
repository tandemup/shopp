// Import a complete, already-validated playlist backup without any Convex writes.
import * as repository from "@/src/storage/playlists/playlistRepository";
import { getLocalLyrics, saveLocalLyrics } from "@/src/storage/lyricsStorage";
const signature = p => `${String(p.title || "").toLowerCase()}|${(p.tracks || []).map(t=>t.videoId || t.playlistId).join(",")}`;
export async function importPlaylistsLocally({ playlists, existing = [], collection }) {
  if (!["playlist", "classical"].includes(collection)) throw new Error("Colección local incorrecta");
  const known = new Set(existing.map(signature));
  let added=0, skipped=0, lyricsRestored=0, conflicts=0;
  for (const playlist of playlists) {
    if (playlist.collectionType !== collection) throw new Error("El tipo del respaldo no corresponde a esta colección.");
    const sig=signature(playlist);
    // Restore all missing LRCs first, even for playlists that already exist locally.
    for (const track of playlist.tracks) {
      if (!track.lyricsBackup) continue;
      const current = await getLocalLyrics(track);
      if (current && String(current.text || "").trim()) {
        if (current.text !== track.lyricsBackup.text) conflicts++;
        continue; // Never overwrite local edits without asking.
      }
      await saveLocalLyrics(track, track.lyricsBackup.text, { fileName: track.lyricsBackup.fileName });
      lyricsRestored++;
    }
    if (known.has(sig)) { skipped++; continue; }
    await repository.create({
      title: playlist.title,
      collectionType: collection,
      shareable: playlist.shareable === true,
      ...(collection === "classical" ? Object.fromEntries(["composer","performer","conductor","orchestra","period","year"].map(k=>[k,playlist[k]||""])) : {}),
      tracks: playlist.tracks.map(({ lyricsBackup, ...track })=>({
        ...track,
        ...(lyricsBackup ? {lyricsFileName:lyricsBackup.fileName, lyricsMimeType:"text/plain", lyricsSize:new TextEncoder().encode(lyricsBackup.text).length} : {}),
      })),
    });
    known.add(sig); added++;
  }
  return { added, skipped, lyricsRestored, conflicts };
}
