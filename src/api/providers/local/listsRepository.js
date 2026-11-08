import { loadLists, saveLists } from "@/src/storage/listsStorage";
import { STORAGE_KEYS, getUserScopedStorageKey } from "@/src/storage/storageKeys";

/**
 * Local-only lists repository: NO Convex/network calls.
 * Preserve key format and JSON data shape for existing installations.
 */
export function getListsStorageKey({ guestMode = false, userId } = {}) {
  return getUserScopedStorageKey(
    guestMode ? "guest-local-v1" : (userId || "anonymous"),
    STORAGE_KEYS.LISTS,
  );
}

export const listsRepository = Object.freeze({
  load: (storageKey) => loadLists(storageKey),
  save: (lists, storageKey) => saveLists(lists, storageKey),
});
