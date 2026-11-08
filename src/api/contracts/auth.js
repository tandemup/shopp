/**
 * Phase 1D: backend-neutral session and authorization data contract.
 * Authentication/authorization MUST be enforced server-side; these functions
 * control UI presentation only and are not security boundaries.
 */
export const USER_ROLES = Object.freeze({ ADMIN: "admin", TESTER: "tester", USER: "user" });
export const ACCOUNT_STATUS = Object.freeze({ BLOCKED: "blocked" });

export function normalizeShoppUser(user) {
  if (user == null) return user; // preserve null (signed out) and undefined (loading)
  return {
    ...user,
    role: user.role || (user.isAdmin === true ? USER_ROLES.ADMIN : USER_ROLES.USER),
    isAdmin: user.isAdmin === true || user.role === USER_ROLES.ADMIN,
    permissions: user.permissions ?? {},
  };
}

export function canAccessFeature(user, feature) {
  if (!user || user.status === ACCOUNT_STATUS.BLOCKED || !feature) return false;
  return user.isAdmin === true || user.role === USER_ROLES.ADMIN || user.permissions?.[feature] === true;
}

export function isAccountBlocked(user) {
  return user?.status === ACCOUNT_STATUS.BLOCKED;
}
