# Fase Node: usuarios, roles y permisos

Este tramo permite administrar cuentas Node sin depender de `convex/users.js`.

## Incluido

- Listado de cuentas y edición de rol (`user`, `tester`, `admin`) para administradores.
- Activación o bloqueo de cuentas. El servidor revoca las sesiones activas al bloquear una cuenta.
- Edición de las utilidades permitidas para cada cuenta no administradora.
- Panel de revisión Node para aprobar o rechazar las propuestas de producto pendientes; la aprobación publica la ficha compartida.
- El rol tester recibe un perfil inicial (Tiendas, Escáner, Música, Música clásica, Tutoriales e intercambio P2P) si aún no tiene permisos asignados.
- Las rutas `scanner`, `stores` y `chat` comprueban el permiso en el servidor. Las operaciones de escritura directa del catálogo requieren rol `admin`; las propuestas de producto se envían a revisión. El cliente solo controla qué botones muestra; no es una barrera de seguridad.
- La pantalla Node de usuarios solo aparece para una cuenta con rol administrador, y todas las operaciones vuelven a comprobar ese rol en Express.

## Endpoints

Todas las rutas requieren `Authorization: Bearer <token>` y el rol `admin`:

- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:userId/role` con `{ "role": "tester" }`
- `PATCH /api/v1/admin/users/:userId/status` con `{ "status": "blocked" }`
- `PATCH /api/v1/admin/users/:userId/permissions` con un objeto cuyas claves son las utilidades admitidas y cuyos valores son booleanos.

## Abrir el panel en Node

Inicia sesión con una cuenta Node promovida previamente a administrador. En la cabecera de Compras pulsa el icono de usuarios. El primer administrador se crea con:

```bash
docker compose exec api npm run auth:bootstrap-admin -- correo@dominio.com
```

## Pendiente

- Invitaciones para testers con vigencia y revocación.
- Migrar cuentas, perfiles, avatares, roles y permisos de Convex a PostgreSQL, con un mapeo revisable antes de importar.
- Aplicar y comprobar los permisos en todos los módulos que se migren después.
- Completar las pantallas de administración de catálogos y solicitudes.

No se requiere la sesión puente `convex/nodeSessionBridge` en el modo de acceso Node: `NodeAuthProvider` valida directamente la sesión JWT con Express. Convex sigue activo en el modo Convex y para las funciones todavía no migradas.
