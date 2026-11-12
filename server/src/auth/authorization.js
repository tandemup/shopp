function deny(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

export function requireAuth(req, res, next) {
  if (!req.auth?.user) return deny(res, 401, 'authentication_required', 'Inicia sesión para continuar.');
  return next();
}

export function requireAdmin(req, res, next) {
  if (!req.auth?.user) return deny(res, 401, 'authentication_required', 'Inicia sesión para continuar.');
  if (req.auth.user.role !== 'admin') {
    return deny(res, 403, 'admin_required', 'Se requieren permisos de administrador.');
  }
  return next();
}

export function requireFeature(feature) {
  if (typeof feature !== 'string' || !feature.trim()) {
    throw new TypeError('requireFeature necesita una clave de permiso.');
  }
  return (req, res, next) => {
    if (!req.auth?.user) return deny(res, 401, 'authentication_required', 'Inicia sesión para continuar.');
    const user = req.auth.user;
    if (user.role !== 'admin' && user.permissions?.[feature] !== true) {
      return deny(res, 403, 'feature_forbidden', 'No tienes permiso para usar esta función.');
    }
    return next();
  };
}
