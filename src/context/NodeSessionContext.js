import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAction, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { nodeAuthApi } from '@/src/api/providers/node/auth';

const NodeSessionContext = createContext(null);

export function NodeSessionProvider({ children }) {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const createNodeSession = useAction(api.nodeSessionBridge.createSession);
  const bridgeEnabled = Boolean(process.env.EXPO_PUBLIC_API_URL?.trim());
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const tokenRef = useRef(null);

  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;

    if (!isAuthenticated) {
      const previousToken = tokenRef.current;
      tokenRef.current = null;
      setSession(null);
      setError(null);
      setStatus('signed_out');
      if (previousToken) nodeAuthApi.logout(previousToken).catch(() => {});
      return () => { cancelled = true; };
    }

    if (!bridgeEnabled) {
      setSession(null);
      setError(null);
      setStatus('disabled');
      return () => { cancelled = true; };
    }

    setStatus('loading');
    setError(null);
    createNodeSession({})
      .then((nextSession) => {
        if (cancelled) {
          if (nextSession?.token) nodeAuthApi.logout(nextSession.token).catch(() => {});
          return;
        }
        tokenRef.current = nextSession?.token || null;
        setSession(nextSession || null);
        setStatus(nextSession?.token ? 'ready' : 'error');
      })
      .catch((cause) => {
        if (cancelled) return;
        tokenRef.current = null;
        setSession(null);
        setError(cause?.message || 'No se pudo abrir la sesión Node.');
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated, bridgeEnabled, createNodeSession]);

  return (
    <NodeSessionContext.Provider value={{ session, accessToken: session?.token || null, status, error }}>
      {children}
    </NodeSessionContext.Provider>
  );
}

export function useNodeSession() {
  const context = useContext(NodeSessionContext);
  if (!context) throw new Error('useNodeSession debe utilizarse dentro de NodeSessionProvider.');
  return context;
}
