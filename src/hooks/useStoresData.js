import { useStoresBackend } from "@/src/api/providers/convex/useStoresBackend";

/** Stable store-catalog contract. Phase 1B uses the Convex implementation. */
export function useStoresData({ enabled = false } = {}) {
  return useStoresBackend({ enabled });
}
