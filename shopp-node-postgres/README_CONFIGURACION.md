# Configuración de entorno corregida

Este paquete separa las variables públicas de Expo de los secretos del servidor.

- `app/.env` y `app/.env.local`: van en la raíz de Shopp, junto a `package.json`. Convex sigue disponible como proveedor independiente; `EXPO_PUBLIC_API_URL` identifica Express cuando la app selecciona Node. Si cambia el dominio HTTPS de Express, actualiza esa variable del cliente.
- `app/.env.example`: plantilla pública. No contiene secretos.
- `shopp-node-postgres/.env`: va junto al `docker-compose.yml` del servidor. Conserva las credenciales PostgreSQL, incorpora secretos JWT y OTP aleatorios y coloca aquí las variables privadas de autenticación. `AUTH_RESEND_KEY` debe configurarse desde Resend para habilitar verificación y recuperación por correo. No requiere secretos de puente con Convex.
- `shopp-node-postgres/.env.example`: plantilla del backend con marcadores, sin secretos estáticos.

No subas `.env` ni `.env.local` a Git. Tras cambiar el `.env` del servidor, reinicia la API con `docker compose up -d --build api`. Tras cambiar variables Expo, reinicia Metro con `npx expo start --web -c`.
