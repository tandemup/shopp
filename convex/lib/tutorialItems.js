export const MAX_TUTORIAL_ITEMS = 100;

export function tutorialItemKey(track) {
  return track.kind === "album" ? `album:${track.playlistId}` : `single:${track.videoId}`;
}

export function mergeTutorialItems(source, destination, itemKeys) {
  const requested = new Set(itemKeys);
  if (!requested.size || itemKeys.length > MAX_TUTORIAL_ITEMS)
    throw new Error("Selecciona entre 1 y 100 elementos para copiar.");
  const selected = source.filter((track) => requested.has(tutorialItemKey(track)));
  if (selected.length !== requested.size)
    throw new Error("La lista de origen ha cambiado. Selecciona y copia los elementos de nuevo.");
  const existing = new Set(destination.map(tutorialItemKey));
  const added = [];
  for (const track of selected) {
    const key = tutorialItemKey(track);
    if (existing.has(key)) continue;
    existing.add(key);
    added.push(track);
  }
  if (destination.length + added.length > MAX_TUTORIAL_ITEMS)
    throw new Error(`No caben los ${added.length} elementos nuevos. La lista de destino tiene ${destination.length}/${MAX_TUTORIAL_ITEMS}. Reduce la selección.`);
  return { tracks: [...destination, ...added], copied: added.length, skipped: selected.length - added.length };
}
