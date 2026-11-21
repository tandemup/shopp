import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { nodeAuthApi } from "@/src/api/providers/node/auth";
import { nodeScanHistoryApi } from "@/src/api/providers/node/scanHistory";

const NodeAuthContext = createContext(null);
const TOKEN_STORAGE_KEY = "@shopp/node-auth-token-v1";
const REFRESH_EARLY_MS = 5 * 60 * 1000;
const REFRESH_RETRY_MS = 30 * 1000;

function expiryTimestamp(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sessionFromResponse(payload) {
  const expiresAt = expiryTimestamp(payload?.expiresAt);
  if (!payload?.token || !payload?.user || !expiresAt) {
    throw new Error("El servidor no devolvió una sesión válida.");
  }
  return { token: payload.token, expiresAt, user: payload.user };
}

export function NodeAuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", session: null, error: null });
  const activeTokenRef = useRef(null);

  const restoreSession = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    let token = null;
    try {
      token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      setState({ status: "error", session: null, error: error?.message || "No se pudo leer la sesión guardada." });
      return;
    }
    if (!token) {
      activeTokenRef.current = null;
      setState({ status: "signed_out", session: null, error: null });
      return;
    }
    try {
      const payload = await nodeAuthApi.me(token);
      const session = { token, expiresAt: expiryTimestamp(payload?.expiresAt), user: payload?.user || null };
      if (!session.user || !session.expiresAt) throw new Error("El servidor no devolvió los datos de la sesión.");
      activeTokenRef.current = token;
      setState({ status: "signed_in", session, error: null });
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        activeTokenRef.current = null;
        await AsyncStorage.removeItem(TOKEN_STORAGE_KEY).catch(() => {});
        setState({ status: "signed_out", session: null, error: null });
      } else {
        setState({ status: "error", session: { token, expiresAt: null, user: null }, error: error?.message || "No se pudo conectar con el servidor Node." });
      }
    }
  }, []);

  useEffect(() => { restoreSession(); }, [restoreSession]);

  const acceptSession = useCallback(async (payload) => {
    const session = sessionFromResponse(payload);
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, session.token);
    activeTokenRef.current = session.token;
    setState({ status: "signed_in", session, error: null });
    return session.user;
  }, []);

  const refreshSession = useCallback(async (currentToken) => {
    const payload = await nodeAuthApi.refresh(currentToken);
    const session = sessionFromResponse(payload);
    if (activeTokenRef.current !== currentToken) return null;
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, session.token);
    if (activeTokenRef.current !== currentToken) {
      const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY).catch(() => null);
      if (storedToken === session.token) await AsyncStorage.removeItem(TOKEN_STORAGE_KEY).catch(() => {});
      return null;
    }
    activeTokenRef.current = session.token;
    setState((current) => current.session?.token === currentToken
      ? { status: "signed_in", session, error: null }
      : current);
    return session;
  }, []);

  useEffect(() => {
    const session = state.session;
    if (state.status !== "signed_in" || !session?.token || !session.expiresAt) return undefined;
    const currentToken = session.token;
    let timer;
    let stopped = false;

    const clearSession = async () => {
      if (activeTokenRef.current !== currentToken) return;
      activeTokenRef.current = null;
      const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY).catch(() => null);
      if (storedToken === currentToken) await AsyncStorage.removeItem(TOKEN_STORAGE_KEY).catch(() => {});
      setState((current) => current.session?.token === currentToken
        ? { status: "signed_out", session: null, error: null }
        : current);
    };

    const renew = async () => {
      try {
        await refreshSession(currentToken);
      } catch (error) {
        if (stopped) return;
        if (error?.status === 401 || error?.status === 403 || Date.now() >= session.expiresAt) {
          await clearSession();
          return;
        }
        timer = setTimeout(renew, Math.min(REFRESH_RETRY_MS, session.expiresAt - Date.now()));
      }
    };

    const delay = Math.max(0, session.expiresAt - Date.now() - REFRESH_EARLY_MS);
    timer = setTimeout(renew, delay);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [state.status, state.session?.token, state.session?.expiresAt, refreshSession]);

  const login = useCallback(async ({ email, password }) => {
    const payload = await nodeAuthApi.login({ email, password });
    return acceptSession(payload);
  }, [acceptSession]);

  const register = useCallback((details) => nodeAuthApi.register(details), []);

  const verifyEmail = useCallback(async ({ email, code }) => {
    const payload = await nodeAuthApi.verifyEmail({ email, code });
    return acceptSession(payload);
  }, [acceptSession]);

  const requestPasswordReset = useCallback((email) => nodeAuthApi.requestPasswordReset(email), []);
  const resetPassword = useCallback((details) => nodeAuthApi.resetPassword(details), []);

  const updateProfile = useCallback(async ({ name, alias, scanHistorySyncEnabled }) => {
    const token = activeTokenRef.current;
    if (!token) throw new Error("Inicia sesión para cambiar tu perfil.");
    const payload = await nodeAuthApi.updateProfile(token, { name, alias, scanHistorySyncEnabled });
    if (!payload?.user) throw new Error("El servidor no devolvió el perfil actualizado.");
    setState((current) => current.session?.user?.id === payload.user.id
      ? { ...current, session: { ...current.session, user: payload.user } }
      : current);
    return payload.user;
  }, []);

  const clearScanHistory = useCallback(async () => {
    const token = activeTokenRef.current;
    if (!token) throw new Error("Inicia sesión para borrar tu historial.");
    return nodeScanHistoryApi.clear(token);
  }, []);

  const requestEmailChange = useCallback((email) => {
    const token = activeTokenRef.current;
    if (!token) throw new Error("Inicia sesión para cambiar tu correo.");
    return nodeAuthApi.requestEmailChange(token, email);
  }, []);

  const confirmEmailChange = useCallback(({ email, code }) => {
    const token = activeTokenRef.current;
    if (!token) throw new Error("Inicia sesión para cambiar tu correo.");
    return nodeAuthApi.confirmEmailChange(token, { email, code });
  }, []);

  const signOut = useCallback(async () => {
    const token = state.session?.token;
    activeTokenRef.current = null;
    setState({ status: "signed_out", session: null, error: null });
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY).catch(() => {});
    if (token) await nodeAuthApi.logout(token).catch(() => {});
  }, [state.session?.token]);

  const value = useMemo(() => ({
    status: state.status,
    session: state.session,
    user: state.session?.user || null,
    accessToken: state.session?.token || null,
    error: state.error,
    login,
    register,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
    updateProfile,
    clearScanHistory,
    requestEmailChange,
    confirmEmailChange,
    signOut,
    reloadSession: restoreSession,
  }), [state, login, register, verifyEmail, requestPasswordReset, resetPassword, updateProfile, clearScanHistory, requestEmailChange, confirmEmailChange, signOut, restoreSession]);

  return <NodeAuthContext.Provider value={value}>{children}</NodeAuthContext.Provider>;
}

export function useNodeAuth() {
  const context = useContext(NodeAuthContext);
  if (!context) throw new Error("useNodeAuth debe usarse dentro de NodeAuthProvider.");
  return context;
}
