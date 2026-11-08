-- Fase 2A: prueba del volumen persistente y sistema de migraciones.
-- No replicar todavía las tablas Convex sin definir contratos y migración de datos.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
