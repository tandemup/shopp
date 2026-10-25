/** Resolución común de carátulas para tarjetas impresas y playlists. */
export function getCollectionCover(playlist = {}) {
  return String(playlist.cover || playlist.coverUrl || playlist.image || playlist.thumbnail || "").trim();
}

/**
 * Modo automático: imagen de pista > imagen de colección > YouTube.
 * Los modos explícitos siguen prevaleciendo sobre el automático.
 */
export function resolveCardCover({ mode = "auto", trackCover, collectionCover, youtubeCover, cardCover } = {}) {
  const track = String(trackCover || "").trim();
  const collection = String(collectionCover || "").trim();
  const youtube = String(youtubeCover || "").trim();
  const custom = String(cardCover || "").trim();
  if (custom) return custom;
  if (mode === "youtube") return youtube || track || collection;
  if (mode === "general" || mode === "collection") return collection || track || youtube;
  return track || collection || youtube;
}
