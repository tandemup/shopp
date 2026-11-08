import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

/** Preserve Convex Auth's signIn(provider, params) and signOut() signatures. */
export function useConvexAuthActionsBackend() {
  return useAuthActions();
}

/** Preserve the existing isLoading/isAuthenticated session contract. */
export function useConvexAuthSessionBackend() {
  return useConvexAuth();
}
