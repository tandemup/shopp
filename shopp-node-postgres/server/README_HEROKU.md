# Desplegar la API Shopp en Heroku

Esta guía publica **la API Express**. El frontend Expo/PWA puede seguir alojado en Netlify y apuntar a la URL HTTPS de esta API.

## Preparar Heroku

1. Crea una aplicación Heroku desde el Dashboard y añade una base **Heroku Postgres** desde la pestaña Resources. Elige el plan según el uso previsto; algunos planes tienen coste.
2. En Settings → Config Vars, comprueba que Heroku haya definido `DATABASE_URL`. No copies esa URL a la app cliente ni la compartas: contiene credenciales de base de datos.
3. Añade estas variables en Config Vars:

   - `AUTH_JWT_SECRET`: secreto aleatorio de al menos 32 bytes.
   - `AUTH_CHALLENGE_SECRET`: secreto aleatorio de al menos 32 bytes.
   - `AUTH_RESEND_KEY`: clave privada de Resend.
   - `AUTH_EMAIL_FROM`: remitente verificado en Resend.
   - `CORS_ORIGINS`: origen HTTPS exacto del frontend, sin rutas ni barra final. Para varios orígenes, sepáralos por comas.
   - `AUTH_JWT_ISSUER` y `AUTH_JWT_AUDIENCE`: opcionales; los valores predeterminados son `shopp-api` y `shopp-client`.

   Puedes generar cada secreto en Terminal con `openssl rand -hex 32`. No uses los valores de ejemplo ni pegues secretos en Git.

## Publicar el subdirectorio `server`

El directorio `server/` es la raíz de la aplicación Heroku: contiene `package.json`, `Procfile`, el código y las migraciones. Desde la raíz del checkout Git de Shopp:

```sh
heroku login
heroku git:remote -a NOMBRE_DE_TU_APP
git subtree push --prefix shopp-node-postgres/server heroku main
```

Si el remoto `heroku` ya está asignado a otra aplicación, revisa `git remote -v` antes de cambiarlo. El comando subtree publica solo `server/` en la raíz de Heroku; no publica la aplicación Expo.

## Comprobar el despliegue

```sh
heroku logs --tail -a NOMBRE_DE_TU_APP
curl -i https://NOMBRE_DE_TU_APP.herokuapp.com/api/ready
```

La respuesta esperada de `/api/ready` es JSON con `"status":"ready"` y `"database":"connected"`. El servidor escucha automáticamente en el puerto `PORT` que proporciona Heroku. Al arrancar, la API aplica las migraciones SQL locales de `server/migrations/`.

## Conectar el frontend

Configura en el entorno de compilación del frontend:

```env
EXPO_PUBLIC_BACKEND_PROVIDER=node
EXPO_PUBLIC_API_URL=https://NOMBRE_DE_TU_APP.herokuapp.com
```

Después recompila y publica el frontend en su alojamiento habitual. `EXPO_PUBLIC_API_URL` es pública; no pongas ahí secretos del servidor.

## Alcance y operación

- La puesta en marcha crea/actualiza las tablas definidas por las migraciones del servidor. **No importa datos ni cuentas de Convex**, según la decisión del proyecto.
- El proceso `web` y el puerto dinámico siguen el modelo de ejecución de Heroku. PostgreSQL remoto usa `DATABASE_URL` y TLS con validación del certificado activada por defecto.
- Las variables de autenticación por correo deben estar completas antes de probar registro o inicio de sesión.
- Esta guía no crea la aplicación, no elige ni contrata un plan, y no publica nada en la cuenta Heroku. Revisa el coste del plan de base de datos antes de activarlo.
