/**
 * Phase 1D: preserve Convex's three-way auth gates while moving imports
 * out of application navigation. A Node adapter will replace these later.
 */
export {
  Authenticated as ShoppAuthenticated,
  AuthLoading as ShoppAuthLoading,
  Unauthenticated as ShoppUnauthenticated,
} from "convex/react";
