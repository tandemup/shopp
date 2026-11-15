# Backend Node.js + PostgreSQL de Shopp (fase de autenticación)

Esta carpeta contiene un servicio Express independiente con PostgreSQL. Implementa autenticación por correo con OTP, inicio/cierre de sesión y recuperación de contraseña. La app Shopp sigue usando Convex mientras se completa y valida la integración del proveedor Node.

## Requisitos

- Docker Desktop y `docker compose`.
- Una cuenta de Resend con clave privada y remitente autorizado para producción.

## Configurar

Desde esta carpeta, si todavía no existe `.env`:

```bash
cp .env.example .env
```

Si ya tienes `.env`, **no lo sobrescribas**: conserva el `POSTGRES_PASSWORD` que corresponde al volumen existente y añade solo las variables nuevas de autenticación. Cambiar la contraseña en `.env` no actualiza por sí solo la contraseña del rol guardada en un volumen PostgreSQL existente.

Para una instalación nueva, genera dos secretos distintos:

```bash
openssl rand -hex 24
openssl rand -base64 48
```

En una instalación nueva, usa el primer resultado en `POSTGRES_PASSWORD`; usa el segundo en `AUTH_CHALLENGE_SECRET`. En una instalación existente conserva su `POSTGRES_PASSWORD` y genera solo `AUTH_CHALLENGE_SECRET` con el segundo comando. Completa `AUTH_RESEND_KEY` y `AUTH_EMAIL_FROM` con los datos de tu cuenta de Resend. No compartas `.env` ni lo subas a Git.

El archivo de ejemplo usa `API_PORT=3001` para evitar el conflicto local que ocurrió con el puerto 3000. Si ese puerto también está ocupado, elige otro puerto libre.

## Arrancar

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

La API se publica en `http://localhost:3001`. PostgreSQL queda en la red privada de Compose como `db:5432`; sus datos persisten en `postgres_data`.

Comprobaciones:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/ready
```

## Rutas de autenticación

Todas están bajo `/api/v1/auth`:

| Método y ruta | Uso |
|---|---|
| `POST /register` | Crea una cuenta pendiente y envía un código de verificación de 8 dígitos. |
| `POST /verify-email` | Verifica el correo y devuelve una sesión. |
| `POST /login` | Inicia sesión con correo y contraseña. |
| `GET /me` | Devuelve identidad, rol, estado y permisos actuales. Requiere `Authorization: Bearer <token>`. |
| `POST /logout` | Revoca la sesión actual. Requiere Bearer. |
| `POST /request-password-reset` | Solicita un código para restablecer la contraseña. |
| `POST /reset-password` | Cambia la contraseña con el código recibido y revoca sesiones anteriores. |

Ejemplo de registro:

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"usuario@example.com","name":"Usuario","password":"UnaClaveSegura8"}'
```

Los códigos caducan a los 15 minutos y permiten como máximo cinco intentos. Los endpoints públicos de autenticación tienen límite de solicitudes en memoria por instancia.

## Crear el primer administrador

Primero registra y verifica la cuenta. Luego promuévela desde el contenedor:

```bash
docker compose exec api npm run auth:bootstrap-admin -- usuario@example.com
```

La cuenta debe existir, estar activa y tener el correo verificado. El rol y los permisos se leen de PostgreSQL; la API no confía en roles enviados por el cliente. Las futuras rutas protegidas pueden usar `requireAuth`, `requireAdmin` o `requireFeature('stores')`.

## Migraciones y datos

Las migraciones SQL de `server/migrations/` se aplican automáticamente al iniciar la API y se anotan en `schema_migrations`. Añade una nueva migración numerada para cada cambio posterior. No borres el volumen para aplicar cambios.

Para detener servicios sin eliminar datos:

```bash
docker compose down
```

No uses `docker compose down -v` salvo que quieras borrar permanentemente la base local.

## Estado y límites de esta fase

- No activa `EXPO_PUBLIC_BACKEND_PROVIDER=node`; Convex sigue siendo el proveedor activo de Shopp.
- No importa usuarios ni contraseñas de Convex.
- Las rutas de Tiendas, listas y chat aún están pendientes.
- Antes de usarlo con usuarios reales, configura Resend, orígenes CORS de producción y HTTPS en un proxy inverso. El limitador actual vive en memoria y está pensado para una sola instancia.
