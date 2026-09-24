import { getAuthUserId } from "@convex-dev/auth/server";

export async function requireUser(ctx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("Debes iniciar sesión.");
  }

  const user = await ctx.db.get(userId);

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  if (user.status === "blocked") {
    throw new Error("Usuario bloqueado.");
  }

  return user;
}

export async function requireAdmin(ctx) {
  const user = await requireUser(ctx);

  const isAdmin = user.role === "admin" || user.isAdmin === true;

  if (!isAdmin) {
    throw new Error("No tienes permisos de administrador.");
  }

  return user;
}

// Úsalo en las mutaciones o consultas de una utilidad que tenga datos en
// Convex. La interfaz también comprueba el permiso, pero la autorización
// definitiva debe permanecer en el servidor.
export async function requireFeature(ctx, feature) {
  const user = await requireUser(ctx);

  if (user.role === "admin" || user.isAdmin === true) {
    return user;
  }

  if (user.permissions?.[feature] === true) {
    return user;
  }

  throw new Error("No tienes acceso a esta utilidad.");
}
