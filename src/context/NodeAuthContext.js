import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { nodeAuthApi } from "@/src/api/providers/node/auth";

const NodeAuthContext = createContext(null);
const TOKEN_STORAGE_KEY = "@shopp/node-auth-token-v1";

function sessionFromResponse(payload) {
  if (!payload?.token || !payload?.user) {
    throw new Error("El servidor no devolvió una sesión válida.");
  }
  return { token: payload.token, expiresAt: payload.expiresAt || null, user: payload.user };
}

export function NodeAuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", session: null, error: null });

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
      setState({ status: "signed_out", session: null, error: null });
      return;
    }
    try {
      const payload = await nodeAuthApi.me(token);
      const session = { token, expiresAt: null, user: payload?.user || null };
      if (!session.user) throw new Error("El servidor no devolvió los datos de la cuenta.");
      setState({ status: "signed_in", session, error: null });
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
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
    setState({ status: "signed_in", session, error: null });
    return session.user;
  }, []);

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

  const signOut = useCallback(async () => {
    const token = state.session?.token;
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
    signOut,
    reloadSession: restoreSession,
  }), [state, login, register, verifyEmail, requestPasswordReset, resetPassword, signOut, restoreSession]);

  return <NodeAuthContext.Provider value={value}>{children}</NodeAuthContext.Provider>;
}

export function useNodeAuth() {
  const context = useContext(NodeAuthContext);
  if (!context) throw new Error("useNodeAuth debe usarse dentro de NodeAuthProvider.");
  return context;
}
