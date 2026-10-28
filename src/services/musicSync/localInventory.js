// Read-only device inventory for the first migration.
// Never uploads, deletes, replaces, or alters existing playlists.
import * as playlistRepo from "@/src/storage/playlists/playlistRepository";

export async function inspectLocalMusic() {
  const [music, classical, musicAudit, classicalAudit] = await Promise.all([
    playlistRepo.list("playlist"),
    playlistRepo.list("classical"),
    playlistRepo.auditLocalPlaylists("playlist"),
    playlistRepo.auditLocalPlaylists("classical"),
  ]);
  const sanitize = rows => rows.map(p => ({
    id: p.id,
    collectionType: p.collectionType,
    title: String(p.title || ""),
    trackCount: Array.isArray(p.tracks) ? p.tracks.length : 0,
    updatedAt: p.updatedAt || null,
  }));
  return {
    schema: "shopp-music-sync-inventory",
    version: 1,
    collectedAt: new Date().toISOString(),
    music: sanitize(music),
    classical: sanitize(classical),
    audit: { music: musicAudit, classical: classicalAudit },
  };
}
