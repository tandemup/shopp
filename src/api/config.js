/** Backend selector for the gradual migration away from Convex. */
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
    return `EXPO_PUBLIC_BACKEND_PROVIDER no válido: ${BACKEND_PROVIDER}. Usa convex o node.`;
  }
  if (isNodeBackend) {
    if (!API_BASE_URL) return "Falta EXPO_PUBLIC_API_URL para usar el backend Node.js.";
    try {
      const url = new URL(API_BASE_URL);
      if (!['http:', 'https:'].includes(url.protocol) || !url.host) throw new Error('invalid');
    } catch {
      return "EXPO_PUBLIC_API_URL debe ser una URL HTTP o HTTPS válida.";
    }
  }
  return null;
}
