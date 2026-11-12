import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "network_error", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function resolveEndpoint(baseUrl, path) {
  if (!baseUrl) {
    throw new ApiError("Falta EXPO_PUBLIC_API_URL.", {
      code: "api_url_missing",
    });
  }

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new ApiError("EXPO_PUBLIC_API_URL no es una URL válida.", {
      code: "api_url_invalid",
    });
  }

  if (typeof path !== "string" || !path.trim()) {
    throw new ApiError("La ruta de la API debe ser una ruta relativa.", {
      code: "api_path_invalid",
    });
  }

  const relativePath = path.replace(/^\/+/, "");
  let endpoint;
  try {
    endpoint = new URL(relativePath, base.href.endsWith("/") ? base : `${base.href}/`);
  } catch {
    throw new ApiError("La ruta de la API no es válida.", {
      code: "api_path_invalid",
    });
  }

  // Do not let a caller accidentally send a bearer token to another origin.
  if (endpoint.origin !== base.origin) {
    throw new ApiError("La ruta de la API debe pertenecer al servidor configurado.", {
      code: "api_origin_mismatch",
    });
  }

  return endpoint.toString();
}

async function readResponse(response) {
  if (response.status === 204) return undefined;

  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text || undefined;
}

function errorFromResponse(response, payload) {
  const nested = payload && typeof payload === "object" ? payload.error : null;
  const source = nested && typeof nested === "object" ? nested : payload;
  const message =
    (source && typeof source === "object" && source.message) ||
    (typeof source === "string" && source) ||
    `La API respondió con HTTP ${response.status}.`;

  return new ApiError(message, {
    status: response.status,
    code:
      (source && typeof source === "object" && source.code) ||
      (typeof payload?.error === "string" && payload.error) ||
      "http_error",
    details: source && typeof source === "object" ? source.details ?? null : null,
  });
}

/**
 * Cliente HTTP común para futuras implementaciones de proveedores.
 * No selecciona el proveedor ni gestiona el almacenamiento de sesiones.
 */
export function createApiClient({ baseUrl = API_BASE_URL, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new ApiError("Este entorno no dispone de fetch.", { code: "fetch_unavailable" });
  }

  return {
    async request(path, options = {}) {
      const {
        method = "GET",
        body,
        headers: suppliedHeaders = {},
        accessToken,
        signal,
      } = options;
      const headers = new Headers(suppliedHeaders);
      headers.set("Accept", "application/json");

      let requestBody = body;
      if (body !== undefined && body !== null) {
        const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
        const isBinaryBody = typeof body === "string" || isFormData;
        if (!isBinaryBody) {
          headers.set("Content-Type", "application/json");
          requestBody = JSON.stringify(body);
        }
      }
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

      let response;
      try {
        response = await fetchImpl(resolveEndpoint(baseUrl, path), {
          method,
          headers,
          body: requestBody,
          signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new ApiError("No se pudo conectar con el servidor Shopp.", {
          code: "network_error",
          details: error?.message || null,
        });
      }

      const payload = await readResponse(response);
      if (!response.ok) throw errorFromResponse(response, payload);
      return payload;
    },
  };
}

export const apiClient = createApiClient();
