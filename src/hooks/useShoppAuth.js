import {
  useConvexAuthActionsBackend,
  useConvexAuthSessionBackend,
} from "@/src/api/providers/convex/useAuthBackend";

/** Authentication API used by Shopp screens (currently backed by Convex). */
export function useShoppAuthActions() {
  return useConvexAuthActionsBackend();
}

/** Reactive session state; future Node implementation must match this shape. */
export function useShoppAuthSession() {
  return useConvexAuthSessionBackend();
}
