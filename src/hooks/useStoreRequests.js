import { useStoreRequestsBackend } from "@/src/api/providers/convex/useStoreRequestsBackend";

/** Stable store-request contract; preserve admin-only subscription. */
export function useStoreRequests({ listEnabled = false } = {}) {
  return useStoreRequestsBackend({ listEnabled });
}
