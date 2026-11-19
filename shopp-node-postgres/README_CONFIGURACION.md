# Configuración de entorno corregida

Este paquete separa las variables públicas de Expo de los secretos del servidor.

- `app/.env` y `app/.env.local`: van en la raíz de Shopp, junto a `package.json`. Ambos conservan Convex como proveedor activo e incluyen la URL pública actual del túnel para las llamadas de Node. Si Cloudflare cambia la URL, actualiza `EXPO_PUBLIC_API_URL` en ambos.
- `app/.env.example`: plantilla pública. No contiene secretos.
- `shopp-node-postgres/.env`: va junto al `docker-compose.yml` del servidor. Conserva las credenciales PostgreSQL y el secreto de puente del `.env` del servidor enviado, incorpora un secreto JWT aleatorio y coloca aquí las variables privadas de autenticación. `AUTH_RESEND_KEY` queda vacío porque el archivo proporcionado no contenía una clave válida; rellénalo desde Resend para habilitar los flujos de correo. Antes de probar el puente, comprueba que `CONVEX_NODE_BRIDGE_SECRET` en Convex coincide con el del servidor.
- `shopp-node-postgres/.env.example`: plantilla del backend con marcadores, sin secretos estáticos.

No subas `.env` ni `.env.local` a Git. Tras cambiar el `.env` del servidor, reinicia la API con `docker compose up -d --build api`. Tras cambiar variables Expo, reinicia Metro con `npx expo start --web -c`.
