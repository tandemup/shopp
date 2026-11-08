import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * First stable Shopp hook: preserves the existing Convex return contract
 * (undefined while loading, null when unauthenticated, or user object).
 * Do not conditionally invoke this hook; use `enabled` to skip the query.
 * The Node provider will be added in a later migration stage.
 */
export function useCurrentUser({ enabled = true } = {}) {
  return useQuery(api.users.current, enabled ? {} : "skip");
}
