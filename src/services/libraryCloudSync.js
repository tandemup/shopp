import { api } from "@/convex/_generated/api";

const MAX_CHUNK_CHARS = 200_000;

function createSnapshotId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `library-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  );
}

export async function downloadLibraryCloudSnapshot(convex, manifest) {
  if (!manifest?.snapshotId || !Number.isInteger(manifest.chunkCount)) {
    return null;
  }
  if (manifest.chunkCount < 1 || manifest.chunkCount > 500) {
    throw new Error("La copia de Biblioteca en la cuenta tiene un índice no válido.");
  }

  const chunks = [];
  for (let index = 0; index < manifest.chunkCount; index += 1) {
    const chunk = await convex.query(api.librarySync.getChunk, {
      snapshotId: manifest.snapshotId,
      index,
    });
    if (typeof chunk !== "string") {
      throw new Error(`No se pudo descargar el bloque ${index + 1} de Biblioteca.`);
    }
    chunks.push(chunk);
  }

  const snapshot = JSON.parse(chunks.join(""));
  if (
    snapshot?.format !== "shopp-library-p2p-sync" ||
    !Array.isArray(snapshot.links) ||
    !Array.isArray(snapshot.folders)
  ) {
    throw new Error("La copia sincronizada de Biblioteca no tiene un formato válido.");
  }
  return snapshot;
}

export async function uploadLibraryCloudSnapshot(convex, snapshot, manifest) {
  const payload = JSON.stringify(snapshot);
  const chunks = [];
  for (let offset = 0; offset < payload.length; offset += MAX_CHUNK_CHARS) {
    chunks.push(payload.slice(offset, offset + MAX_CHUNK_CHARS));
  }
  if (!chunks.length) chunks.push(payload);
  if (chunks.length > 500) {
    throw new Error("La Biblioteca supera el máximo de bloques de sincronización.");
  }

  const snapshotId = createSnapshotId();
  for (let start = 0; start < chunks.length; start += 4) {
    await Promise.all(
      chunks.slice(start, start + 4).map((chunk, offset) =>
        convex.mutation(api.librarySync.putChunk, {
          snapshotId,
          index: start + offset,
          payload: chunk,
        }),
      ),
    );
  }

  const committed = await convex.mutation(api.librarySync.commitSnapshot, {
    snapshotId,
    chunkCount: chunks.length,
    ...(manifest?.snapshotId
      ? { expectedSnapshotId: manifest.snapshotId }
      : {}),
  });
  return { ...committed, snapshotId, chunkCount: chunks.length };
}
