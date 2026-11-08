/**
 * Backend selector for the gradual migration away from Convex.
 * Phase 1A supports Convex ONLY; Node.js is intentionally fail-closed.
 * Expo inlines statically referenced EXPO_PUBLIC_* variables at build time.
 */
export const BACKEND_PROVIDERS = Object.freeze({
  CONVEX: "convex",
  NODE: "node",
});

const configuredProvider = process.env.EXPO_PUBLIC_BACKEND_PROVIDER?.trim().toLowerCase();

export const BACKEND_PROVIDER = configuredProvider || BACKEND_PROVIDERS.CONVEX;
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || "";
export const isConvexBackend = BACKEND_PROVIDER === BACKEND_PROVIDERS.CONVEX;
export const isNodeBackend = BACKEND_PROVIDER === BACKEND_PROVIDERS.NODE;

export function getBackendConfigurationError() {
  if (!Object.values(BACKEND_PROVIDERS).includes(BACKEND_PROVIDER)) {
    return `EXPO_PUBLIC_BACKEND_PROVIDER no válido: ${BACKEND_PROVIDER}. Usa convex.`;
  }
  if (isNodeBackend) {
    return "El backend Node.js aún no está implementado. Mantén EXPO_PUBLIC_BACKEND_PROVIDER=convex durante la fase 1.";
  }
  return null;
}
