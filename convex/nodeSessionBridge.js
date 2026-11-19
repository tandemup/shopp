import { getAuthUserId } from '@convex-dev/auth/server';
import { internal } from './_generated/api';
import { action, internalQuery } from './_generated/server';

export const currentAccount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user || user.status === 'blocked') return null;
    if (!user.email || !user.emailVerificationTime) return null;
    return {
      convexUserId: String(user._id),
      email: user.email,
      name: String(user.name || user.email).slice(0, 120),
      emailVerified: true,
    };
  },
});

export const createSession = action({
  args: {},
  handler: async (ctx) => {
    const account = await ctx.runQuery(internal.nodeSessionBridge.currentAccount, {});
    if (!account) throw new Error('La cuenta Convex no está disponible para crear una sesión Node.');

    const apiUrl = String(process.env.SHOPP_NODE_API_URL || '').trim().replace(/\/+$/, '');
    const bridgeSecret = String(process.env.CONVEX_NODE_BRIDGE_SECRET || '');
    if (!apiUrl || bridgeSecret.length < 32) {
      throw new Error('Falta configurar el puente seguro entre Convex y Node.');
    }
    let endpoint;
    try {
      const parsedApiUrl = new URL(apiUrl);
      const localHttp = parsedApiUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedApiUrl.hostname);
      if (parsedApiUrl.protocol !== 'https:' && !localHttp) throw new Error('HTTPS requerido');
      endpoint = new URL('/api/internal/convex-session', parsedApiUrl).toString();
    } catch {
      throw new Error('SHOPP_NODE_API_URL debe ser una URL HTTPS válida (HTTP solo se permite para localhost).');
    }

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopp-Convex-Bridge': bridgeSecret,
        },
        body: JSON.stringify(account),
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor Node de Shopp.');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error?.message || 'No se pudo crear la sesión Node.');
    }
    return await response.json();
  },
});
