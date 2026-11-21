import { apiClient } from "../../httpClient";

/**
 * REST authentication client for the Express API.
 * Session state and token storage remain owned by the app-level auth provider;
 * pass the returned token to protected API calls instead of storing it here.
 */
export const nodeAuthApi = Object.freeze({
  register({ email, name, password }) {
    return apiClient.request("api/v1/auth/register", {
      method: "POST",
      body: { email, name, password },
    });
  },

  verifyEmail({ email, code }) {
    return apiClient.request("api/v1/auth/verify-email", {
      method: "POST",
      body: { email, code },
    });
  },

  login({ email, password }) {
    return apiClient.request("api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
  },

  me(accessToken) {
    return apiClient.request("api/v1/auth/me", { accessToken });
  },

  updateProfile(accessToken, { name, alias, scanHistorySyncEnabled }) {
    return apiClient.request("api/v1/auth/me", {
      method: "PATCH",
      accessToken,
      body: { name, alias, scanHistorySyncEnabled },
    });
  },

  requestEmailChange(accessToken, email) {
    return apiClient.request("api/v1/auth/me/email-change/request", {
      method: "POST",
      accessToken,
      body: { email },
    });
  },

  confirmEmailChange(accessToken, { email, code }) {
    return apiClient.request("api/v1/auth/me/email-change/confirm", {
      method: "POST",
      accessToken,
      body: { email, code },
    });
  },

  refresh(accessToken) {
    return apiClient.request("api/v1/auth/refresh", {
      method: "POST",
      accessToken,
    });
  },

  logout(accessToken) {
    return apiClient.request("api/v1/auth/logout", {
      method: "POST",
      accessToken,
    });
  },

  requestPasswordReset(email) {
    return apiClient.request("api/v1/auth/request-password-reset", {
      method: "POST",
      body: { email },
    });
  },

  resetPassword({ email, code, password }) {
    return apiClient.request("api/v1/auth/reset-password", {
      method: "POST",
      body: { email, code, password },
    });
  },
});
