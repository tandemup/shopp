# Autenticación JWT para Shopp Node

Este paquete cambia los tokens opacos de sesión por JWT firmados con **HS256**. Conserva los endpoints actuales y el campo de respuesta `token`, así que los clientes que ya envían `Authorization: Bearer <token>` mantienen el mismo contrato.

## Archivos incluidos

- `server/src/security.js`: emisión y verificación JWT.
- `server/src/config.js`: secreto e identificadores `issuer`/`audience`.
- `server/src/middleware/auth.js`: valida firma, expiración, emisor, audiencia y sesión activa en PostgreSQL.
- `server/src/routes/auth.js`: emite JWT al verificar correo e iniciar sesión.
- `server/src/routes/auth.js`: emite y rota JWT para las cuentas registradas directamente en Node.
- `docker-compose.yml` y `.env.example`: variables de entorno nuevas. El `.env.example` contiene solo marcadores, nunca secretos reales.

## Instalación local

1. Descomprime este paquete y copia la carpeta `shopp-node-postgres` sobre la carpeta del servidor existente. Conserva tu `.env` y el volumen de PostgreSQL.
2. Genera un secreto para firmar JWT:

   ```bash
   openssl rand -hex 32
   ```

3. Añade el resultado a `shopp-node-postgres/.env`:

   ```env
   AUTH_JWT_SECRET=PEGA_AQUI_EL_SECRETO_GENERADO
   AUTH_JWT_ISSUER=shopp-api
   AUTH_JWT_AUDIENCE=shopp-client
   ```

   No uses `EXPO_PUBLIC_*` para guardar secretos y no compartas el `.env`.

4. Reconstruye y reinicia la API desde `shopp-node-postgres`:

   ```bash
   docker compose up -d --build api
   ```

   La base de datos existente se conserva. Esta modificación no requiere una migración SQL.

## Comportamiento

- `SESSION_TTL_HOURS` determina la duración del JWT y de la sesión en PostgreSQL (por defecto, 168 horas).
- Aunque las credenciales son JWT, cada solicitud protegida consulta la sesión en PostgreSQL. Por eso el cierre de sesión, el bloqueo de cuenta y el cambio de contraseña pueden revocar el acceso inmediatamente.
- El backend solo acepta `HS256`; comprueba firma, `iss`, `aud`, `sub`, `iat` y `exp`.
- `POST /api/v1/auth/refresh` rota un JWT vigente y extiende la sesión; el JWT anterior queda invalidado. El cliente intenta renovar cinco minutos antes de la expiración.
- Los tokens opacos emitidos antes de instalar esta versión dejarán de aceptarse; inicia sesión de nuevo para recibir un JWT.
- El registro/inicio de sesión directo por Node requiere `AUTH_JWT_SECRET`, `AUTH_CHALLENGE_SECRET`, `AUTH_RESEND_KEY` y `AUTH_EMAIL_FROM` configurados. No se comparten ni enlazan cuentas Convex.

## Heroku

Configura `AUTH_JWT_SECRET`, `AUTH_JWT_ISSUER` y `AUTH_JWT_AUDIENCE` como Config Vars privadas de la aplicación Heroku. Mantén el mismo issuer y audience en todas las instancias del mismo entorno. No reutilices el secreto entre desarrollo y producción.

Este paquete solo actualiza la autenticación del backend Node. No cambia las pantallas Expo ni selecciona Node como backend de Shopp.
