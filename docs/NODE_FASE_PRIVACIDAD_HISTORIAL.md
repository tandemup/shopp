# Fase Node: privacidad del historial del escáner

La cuenta Node permite decidir si el historial del escáner se sincroniza con PostgreSQL. La opción está desactivada por defecto y se administra desde **Mi cuenta**. Al activarla, los siguientes escaneos se guardan en el servidor; al desactivarla, Express rechaza nuevas escrituras en el historial remoto. Activarla no importa escaneos anteriores.

Desde la misma pantalla se puede borrar el historial que ya esté guardado en Node. La confirmación aclara que la operación no borra el historial local. Esta preferencia solo pertenece a la cuenta Node; no cambia ajustes ni datos de Convex.

## Cambios

- `server/migrations/014_initialize_user_profiles.sql` crea perfiles Node básicos para cuentas ya existentes; la preferencia `scan_history_sync_enabled` ya está en la tabla `user_profiles`.
- `PATCH /api/v1/auth/me` acepta `scanHistorySyncEnabled` y lo devuelve en el perfil autenticado.
- `POST /api/v1/scans` y `PUT /api/v1/scans/:barcode` requieren la preferencia activa. Consultar o borrar el historial propio sigue permitido.
- El perfil Node incluye el interruptor y la acción de borrar el historial remoto.

## Aplicación

La migración se aplica al iniciar Express. Con Docker Compose:

```bash
cd shopp-node-postgres
docker compose up -d --build
docker compose logs --tail=80 api
```

No hace falta borrar el volumen de PostgreSQL. No se importan cuentas, preferencias ni historiales de Convex.

## Límite conocido

La preferencia controla el historial privado guardado por la API Node. No desactiva el registro agregado de accesos del catálogo, necesario para las estadísticas y protección antiabuso del endpoint de productos.
