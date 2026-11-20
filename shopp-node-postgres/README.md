# Backend Node.js + PostgreSQL de Shopp

Esta carpeta contiene un servicio REST con Express y PostgreSQL. Incluye autenticación por correo con OTP, inicio/cierre de sesión, recuperación de contraseña y persistencia multiusuario de listas de compra y sus productos. La app Shopp sigue usando Convex como proveedor principal mientras se completa la migración de sesión e integración de pantallas.

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

## Rutas REST de listas de compra

Todas requieren `Authorization: Bearer <token>` y están bajo `/api/v1/shopping`.

| Método y ruta | Uso |
|---|---|
| `GET /lists` | Devuelve las listas del usuario autenticado con sus productos. |
| `POST /lists` | Crea una lista; admite un `id` del cliente y productos iniciales. |
| `GET /lists/:listId` | Devuelve una lista propia y sus productos. |
| `PATCH /lists/:listId` | Actualiza nombre, moneda, tienda, estado archivado o metadatos. |
| `DELETE /lists/:listId` | Elimina la lista propia y sus productos en cascada. |
| `POST /lists/:listId/items` | Añade un producto a una lista propia. |
| `PATCH /lists/:listId/items/:itemId` | Actualiza nombre, estado comprado y campos adicionales del producto. |
| `DELETE /lists/:listId/items/:itemId` | Elimina un producto de una lista propia. |

Las respuestas mantienen la forma de listas usada por `ListsContext` (`id`, `name`, `currency`, `items`, `createdAt`, `archived`, `archivedAt`, `storeId`). Los campos adicionales de lista y producto se conservan en columnas JSONB; las claves consultadas con frecuencia y las relaciones usuario/lista/producto quedan normalizadas. Las rutas siempre limitan las consultas al usuario de la sesión, y los productos dependen de la lista mediante una clave foránea compuesta.

En `src/api/providers/node/` hay adaptadores cliente para autenticación, listas, catálogo, historial de escaneos y tiendas. `nodeAuthApi` ofrece registro, verificación, login, consulta de sesión, logout y recuperación de contraseña; el token devuelto debe gestionarse desde el proveedor de sesión de la app y pasarse a los demás adaptadores. Estos adaptadores aún no reemplazan las pantallas Convex: `App.js`, las pantallas de autenticación y varias funciones principales siguen requiriendo Convex.

## Catálogo de productos e historial privado de escaneos

Las rutas requieren Bearer token y están bajo `/api/v1`:

| Método y ruta | Uso |
|---|---|
| `GET /products/:barcode` | Consulta la ficha global del catálogo. |
| `POST /products/:barcode/access` | Registra un acceso e incrementa el contador del catálogo. |
| `PUT /products/:barcode` | Guarda campos del producto; los datos flexibles se conservan en JSONB. |
| `POST /products/:barcode/not-found` | Guarda un resultado negativo con vencimiento de siete días. |
| `DELETE /products/:barcode` | Elimina del catálogo; requiere rol `admin`. |
| `GET /scans?limit=100` | Lista el historial privado del usuario (máximo 300). |
| `GET /scans/:barcode` | Consulta un producto del historial propio. |
| `POST /scans` | Añade un escaneo o incrementa su contador. |
| `PUT /scans/:barcode` | Sincroniza el registro con su contador dado, sin incrementarlo; admite reintentos. |
| `DELETE /scans/:barcode` | Elimina un escaneo propio. |
| `DELETE /scans` | Vacía únicamente el historial del usuario autenticado. |

El catálogo es compartido entre cuentas; el historial usa una clave compuesta por usuario y código. La API no devuelve ni elimina historiales de otros usuarios.

## Tiendas, favoritos y solicitudes

Las rutas están bajo `/api/v1/stores`:

| Método y ruta | Uso |
|---|---|
| `GET /` | Lista el catálogo; funciona como invitado y, si se envía token, marca favoritos del usuario. |
| `GET /city/:city` | Filtra tiendas por ciudad. |
| `GET /:id` | Consulta una tienda concreta. |
| `GET /favorites` | Lista los favoritos propios; requiere sesión. |
| `PUT /:id/favorite` | Fija o quita un favorito de forma idempotente. |
| `GET /catalog/export` | Exporta el catálogo; requiere administrador. |
| `POST /catalog/import` | Importa en modo `merge` o `replace`; requiere administrador. |
| `DELETE /:id` | Elimina una tienda; requiere administrador. |
| `POST /requests` | Envía una tienda para revisión. |
| `GET /requests/pending` | Lista solicitudes pendientes; requiere administrador. |
| `POST /requests/:requestId/approve` | Aprueba con coordenadas verificadas; requiere administrador. |
| `POST /requests/:requestId/reject` | Rechaza una solicitud; requiere administrador. |

Los favoritos y las solicitudes están asociados a la identidad Node autenticada. El catálogo sigue siendo visible sin sesión, como en el modo invitado de Shopp.

## Ofertas de tiendas

Las rutas están bajo `/api/v1/store-offers`:

| Método y ruta | Uso |
|---|---|
| `GET /approved?limit=100` | Lista ofertas aprobadas sin exponer datos de contacto ni notas privadas. |
| `GET /mine` | Lista únicamente las solicitudes de la cuenta autenticada. |
| `POST /` | Envía una oferta `shopper` o una propuesta comercial `owner`; requiere sesión. |
| `GET /` | Lista ofertas para moderación, con filtro opcional `?status=pending`; requiere administrador. |
| `PATCH /:id/status` | Cambia el estado a `pending`, `approved` o `rejected`; requiere administrador. |

Las solicitudes comerciales requieren nombre y correo de contacto. Las ofertas permanecen pendientes hasta que un administrador las aprueba.

## Revisión de fichas de producto

Las rutas están bajo `/api/v1/product-reviews`:

| Método y ruta | Uso |
|---|---|
| `POST /` | Envía una propuesta de producto; requiere sesión. Una misma cuenta solo puede mantener una propuesta pendiente por código. |
| `GET /?status=pending_review&limit=100` | Lista propuestas para administración; requiere rol `admin`. |
| `PATCH /:id` | Edita los campos antes de resolver la revisión; requiere administrador. |
| `POST /:id/approve` | Aprueba la propuesta y actualiza el catálogo global dentro de una transacción. |
| `POST /:id/reject` | Rechaza la propuesta y guarda la nota administrativa. |

Si la transacción de aprobación falla, no cambia el estado de la propuesta ni el catálogo.

## Conexión en tiempo real (WebSocket)

La API ofrece una base autenticada para conexiones en vivo. La sesión habitual se cambia por un ticket aleatorio de un solo uso, válido durante 60 segundos:

| Método y ruta | Uso |
|---|---|
| `POST /api/v1/realtime/ticket` | Emite el ticket; requiere `Authorization: Bearer <token>`. |
| `GET /ws?ticket=...` | Inicia la conexión WebSocket y consume el ticket. |

Tras conectar, el servidor envía un mensaje `connected` con identidad mínima. Se puede enviar `{"type":"ping"}` para recibir `pong` y `{"type":"subscribe","rooms":["compras"]}` para recibir los avisos de una sala. Los avisos de chat se envían a las conexiones suscritas en esa instancia del servidor.

El cliente `nodeRealtimeApi.connect(accessToken)` obtiene un ticket con HTTPS y luego abre `ws://` o `wss://` según `EXPO_PUBLIC_API_URL`. La pantalla básica de chat Node usa este flujo con una reconexión automática.

## Chat básico en PostgreSQL

La API incluye persistencia inicial para mensajes de texto y entrega de novedades en vivo. Todas las rutas requieren Bearer token:

| Método y ruta | Uso |
|---|---|
| `GET /api/v1/chat/rooms` | Lista las salas compartidas y el número de mensajes visibles. |
| `POST /api/v1/chat/rooms` | Crea una sala personalizada compartida. |
| `DELETE /api/v1/chat/rooms/:roomId` | Borra mensajes de una sala integrada o elimina una sala personalizada; requiere administrador. |
| `GET /api/v1/chat/messages?room=compras&limit=100&beforeId=...` | Historial paginado (máximo 200 mensajes). |
| `POST /api/v1/chat/messages` | Publica texto; caduca a las 24 horas por defecto. |
| `DELETE /api/v1/chat/messages/:id` | El autor puede borrar su mensaje; el administrador puede borrar cualquiera. |

Los mensajes admiten 280 caracteres, salvo la sala `youtube` (2048). El cliente `nodeChatApi` ofrece consulta y creación de salas, historial, envío, borrado y suscripción WebSocket. Los avisos viajan por PostgreSQL `LISTEN/NOTIFY`, por lo que las conexiones de distintas réplicas de la API pueden recibir cambios. PostgreSQL notifica tras confirmar la transacción; el mensaje completo se vuelve a leer de la tabla antes de difundirlo. La migración `011_chat_rooms.sql` registra las salas integradas y preserva las salas con mensajes anteriores. En la app Node, `NodeChatScreen` incorpora las salas Compras, Música y YouTube, salas personalizadas compartidas, alias, texto, borrado autorizado y reconexión automática. El chat Convex conserva su pantalla completa. Este tramo Node todavía no migra adjuntos, salas cercanas, listas de reproducción ni las herramientas extendidas del chat Convex.

## Puente inicial de sesión Convex → Node

La app conserva Convex como autenticación principal y solicita una sesión Node mediante una acción autenticada de Convex. **El token Convex no se envía a Express**: Convex verifica al usuario y llama al endpoint interno de Node con un secreto compartido.

1. Genera un secreto separado con `openssl rand -hex 32`.
2. Añádelo al `.env` de esta carpeta como `CONVEX_NODE_BRIDGE_SECRET`.
3. Configura el mismo valor en Convex con `npx convex env set CONVEX_NODE_BRIDGE_SECRET "..."`.
4. Configura la URL HTTPS de la API en Convex con `npx convex env set SHOPP_NODE_API_URL "https://api.tu-dominio"`.
5. Reconstruye y arranca la API para aplicar `010_convex_identity_bridge.sql`.
6. Configura esa misma URL pública como `EXPO_PUBLIC_API_URL` en `.env.local` y en el entorno de compilación de la app.
7. Desde la raíz del proyecto, ejecuta el flujo habitual de Convex (`npx convex dev` en desarrollo o `npx convex deploy` en producción) para publicar la acción nueva y regenerar sus referencias.

La cuenta Node se vincula por el ID de usuario Convex; una cuenta Node existente con el mismo correo no se enlaza automáticamente. Las cuentas creadas por el puente reciben rol `user`; el rol administrador se concede aparte con el procedimiento de bootstrap. El token Node permanece en memoria de la app y se vuelve a emitir al iniciar una sesión Convex.

Este puente solo prepara identidad y sesión. **Las listas siguen guardándose localmente**; no actives `EXPO_PUBLIC_BACKEND_PROVIDER=node` todavía.

Ejemplo de creación de lista:

```bash
curl -X POST http://localhost:3001/api/v1/shopping/lists \
  -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' \
  -d '{"id":"lista-1","name":"Compra semanal","currency":"EUR","items":[]}'
```

Ejemplo de registro:

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"usuario@example.com","name":"Usuario","password":"UnaClaveSegura8"}'
```

Los códigos caducan a los 15 minutos y permiten como máximo cinco intentos. Los endpoints de autenticación limitan a 12 solicitudes por IP y ruta cada 15 minutos. El contador se almacena en PostgreSQL, se comparte entre instancias y conserva solo un HMAC de IP/ruta; los registros caducados se eliminan periódicamente.

## Crear el primer administrador

Primero registra y verifica la cuenta. Luego promuévela desde el contenedor:

```bash
docker compose exec api npm run auth:bootstrap-admin -- usuario@example.com
```

La cuenta debe existir, estar activa y tener el correo verificado. El rol y los permisos se leen de PostgreSQL; la API no confía en roles enviados por el cliente. Las futuras rutas protegidas pueden usar `requireAuth`, `requireAdmin` o `requireFeature('stores')`.

## Migraciones y datos

Las migraciones SQL de `server/migrations/` se aplican automáticamente al iniciar la API y se anotan en `schema_migrations`. `002_shopping_lists.sql` crea las tablas de listas y artículos; `003_api_rate_limits.sql` crea el almacenamiento compartido del límite de solicitudes; `004_products_scan_history.sql` crea el catálogo y el historial privado; `005_stores.sql` crea tiendas, favoritos y solicitudes; `006_store_offers.sql` crea propuestas de ofertas; `007_product_reviews.sql` crea la cola de revisión de productos; `008_realtime_tickets.sql` crea tickets WebSocket de corta duración; `009_chat_messages.sql` crea el almacenamiento inicial del chat; `010_convex_identity_bridge.sql` añade la relación opcional con el usuario Convex. Añade una nueva migración numerada para cada cambio posterior. No borres el volumen para aplicar cambios.

Para detener servicios sin eliminar datos:

```bash
docker compose down
```

No uses `docker compose down -v` salvo que quieras borrar permanentemente la base local.

## Estado y límites de esta fase

- No activa `EXPO_PUBLIC_BACKEND_PROVIDER=node`; Convex sigue siendo el proveedor activo de Shopp.
- No importa usuarios ni contraseñas de Convex.
- La API de listas está disponible, pero todavía no se activa desde `ListsContext`; la app continúa guardando listas localmente y usando Convex para los módulos que ya dependían de él.
- La migración completa de usuarios y sesiones de Convex y las rutas de chat siguen pendientes; las pantallas de tiendas, ofertas y revisión de productos todavía usan Convex.
- Antes de usarlo con usuarios reales, configura Resend, orígenes CORS de producción y HTTPS en un proxy inverso. `TRUST_PROXY=true` solo debe activarse si la API está detrás de un proxy controlado que establezca correctamente `X-Forwarded-For`.
