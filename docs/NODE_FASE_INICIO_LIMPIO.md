# Shopp Node: inicio limpio sin migrar datos

## Alcance decidido

La aplicación empezará a usar Node.js/Express y PostgreSQL sin importar usuarios ni datos desde Convex. Cada usuario creará una cuenta nueva en Node. No hay puente de identidad que cree cuentas espejo: Convex y Node mantienen sesiones independientes. La base Node será independiente; los datos existentes en Convex permanecerán allí durante la transición y no aparecerán en Node.

No se necesita un exportador de Convex, un formato de snapshot ni un importador de cuentas/listas. No ejecutes comandos de importación Convex ni borres un volumen PostgreSQL existente sin una copia y una decisión explícita: el requisito de empezar sin datos de Convex no implica que deban borrarse los datos de desarrollo que ya haya en PostgreSQL.

## Autenticación Node que ya existe

- Registro con correo y contraseña.
- Verificación del correo mediante código temporal enviado por email.
- Inicio de sesión que solo admite cuentas verificadas y activas.
- Recuperación y cambio de contraseña mediante código temporal.
- JWT HS256 con sesión registrada en PostgreSQL; el servidor puede revocar sesiones al cerrar sesión o cambiar la contraseña.
- Renovación rotatoria del JWT: `POST /api/v1/auth/refresh` invalida el token anterior y extiende la sesión activa.
- Promoción a administrador de una cuenta ya registrada, verificada y activa mediante `auth:bootstrap-admin`.
- Pantallas Node para login, registro/verificación y recuperación de contraseña, separadas de las pantallas Convex.

El cliente restaura la sesión consultando `/auth/me` y solicita la renovación cinco minutos antes de la caducidad. Si hay un fallo de red temporal, reintenta mientras el token actual siga válido; si expira o el servidor lo revoca, limpia la sesión local y pide iniciar sesión de nuevo.

## Puesta en marcha

1. Configura `shopp-node-postgres/server/.env` con las credenciales PostgreSQL y los secretos de autenticación. No reutilices valores de ejemplo en un entorno accesible desde internet.
2. Configura Resend (`AUTH_RESEND_KEY` y `AUTH_EMAIL_FROM`) para que puedan enviarse códigos de verificación y recuperación.
3. Desde `shopp-node-postgres`, inicia los servicios:

   ```bash
   docker compose up -d --build
   docker compose ps
   docker compose logs --tail=100 api
   ```

4. Comprueba `GET /api/ready` y que la respuesta indique `status: ready` y `database: connected`.
5. En la app de desarrollo, activa Node con `EXPO_PUBLIC_BACKEND_PROVIDER=node` y configura `EXPO_PUBLIC_API_URL` con la URL accesible desde el dispositivo/navegador. Para Expo Go en un móvil, `localhost` apunta al móvil, no al Mac: usa una URL LAN alcanzable o un endpoint HTTPS.
6. Registra una cuenta de prueba desde la pantalla Node y completa la verificación por correo.
7. Promueve esa cuenta a administrador desde el directorio del servidor:

   ```bash
   docker compose exec api npm run auth:bootstrap-admin -- correo@ejemplo.com
   ```

8. Inicia sesión de nuevo y comprueba que las funciones administrativas aparecen y que una cuenta normal no las puede invocar.

## Comprobaciones antes de cambiar de backend

- Registro, código válido, código incorrecto, caducidad y reenvío de verificación.
- Login correcto, contraseña incorrecta, correo no verificado y cuenta bloqueada.
- Solicitud y finalización de recuperación de contraseña.
- Restauración de sesión, renovación rotatoria, rechazo del token anterior, cierre de sesión y rechazo del JWT revocado.
- Separación de datos: una cuenta nueva solo ve sus propias listas y registros.
- Permisos en API además de ocultar acciones en la interfaz.
- CORS con los orígenes reales y HTTPS para el acceso remoto.
- La app vuelve a Convex cuando `EXPO_PUBLIC_BACKEND_PROVIDER=convex` y usa las pantallas Node cuando vale `node`.

## Fases que siguen abiertas

1. Validar renovación/rotación de JWT y el comportamiento sin conexión en Expo Go y web.
2. Completar la comprobación de signup/login/roles en Expo Go y web con PostgreSQL vacío.
3. Revisar que cada módulo elegido para Node tenga autorización por usuario/rol en el servidor.
4. Configurar URL HTTPS estable, CORS de producción y despliegue (Heroku u otro proveedor decidido).
5. Cambiar progresivamente el backend de la app. Convex se mantiene disponible hasta cerrar la validación; no se copiarán sus datos ni identidades.

## Consecuencia para los usuarios

Quien usaba Convex tendrá que registrarse en Node con un correo verificado y crear una contraseña. Sus listas y demás datos Convex no se trasladan. Antes del cambio definitivo, comunica este inicio limpio y conserva el acceso a Convex el tiempo acordado para poder consultar los datos antiguos.
