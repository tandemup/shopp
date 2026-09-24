import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

import { ResendOTPEmailVerification } from "./ResendOTPEmailVerification";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";

// Estas son las utilidades disponibles automáticamente al crear una cuenta.
// Los permisos del administrador siguen siendo implícitamente completos.
const DEFAULT_NEW_USER_PERMISSIONS = {
  scanner: true,
  stores: true,
  musicPlaylist: true,
  classicalMusic: true,
  tutorials: true,
  p2pPlaylistExchange: true,
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: ResendOTPEmailVerification,
      reset: ResendOTPPasswordReset,
    }),
  ],
  callbacks: {
    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get(userId);
      if (user?.status === "blocked") {
        throw new Error("Usuario bloqueado. Contacta con administración.");
      }
    },
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      // Convex Auth invoca este callback también al actualizar una cuenta.
      // Solo inicializamos los permisos cuando se acaba de crear el usuario,
      // sin alterar ninguna cuenta ya existente.
      if (existingUserId) return;

      const user = await ctx.db.get(userId);

      if (user) {
        await ctx.db.patch(userId, {
          role: user.role ?? "user",
          permissions: DEFAULT_NEW_USER_PERMISSIONS,
        });
      }
    },
  },
});
