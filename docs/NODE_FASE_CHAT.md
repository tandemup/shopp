# Migración Node: chat básico en tiempo real

## Incluido

La sesión de Node permite abrir un chat separado del flujo Convex. La pantalla Node ofrece las salas integradas de Shopp (Compras, Música y YouTube), creación de hasta 25 salas compartidas por cuenta, edición local del alias, historial reciente, envío de texto y borrado de mensajes propios. Las cuentas con rol administrador pueden borrar cualquier mensaje, borrar mensajes de una sala integrada o eliminar una sala personalizada junto con sus mensajes.

La conexión usa `POST /api/v1/realtime/ticket` para obtener un ticket de un solo uso y abrir `/ws`. Nunca se pone el JWT de la sesión en la URL WebSocket. Al perder la conexión, el cliente vuelve a intentarlo automáticamente. El servidor difunde los cambios mediante PostgreSQL `LISTEN/NOTIFY`, por lo que varios procesos de la API pueden compartir las novedades. Los mensajes caducan a las 24 horas por defecto; solo administradores pueden marcarlos para conservarlos.

## Archivos principales

- `src/screens/auth/node/NodeChatScreen.js`: interfaz de salas, mensajes y conexión en vivo.
- `src/navigation/NodeAppNavigator.js`: alterna entre listas y chat en la sesión Node.
- `src/screens/auth/node/NodeShoppingListsScreen.js`: acceso al chat desde la pantalla de listas.
- `src/api/providers/node/chat.js` y `src/api/providers/node/realtime.js`: llamadas REST y conexión WebSocket.
- `shopp-node-postgres/server/src/routes/chat.js`: historial, envío y borrado con autorización.
- `shopp-node-postgres/server/migrations/011_chat_rooms.sql`: catálogo compartido de salas y migración de salas ya usadas.
- `shopp-node-postgres/server/src/routes/realtime.js` y `shopp-node-postgres/server/src/realtime.js`: emisión de tickets y canal WebSocket.
- `shopp-node-postgres/server/migrations/008_realtime_tickets.sql` y `009_chat_messages.sql`: tablas requeridas.

## Uso

1. Arranca Express y PostgreSQL con las migraciones aplicadas.
2. Inicia sesión usando el proveedor Node.
3. En la pantalla de listas, pulsa el icono de chat.
4. Elige una sala, escribe un alias y envía un mensaje.

El navegador o dispositivo debe poder alcanzar la URL configurada en `EXPO_PUBLIC_API_URL`. En producción, sirve la API por HTTPS para que el cliente use WSS.

## Alcance pendiente

Esta fase migra chat de texto y gestión básica de salas. Los adjuntos e imágenes, el chat cercano por ubicación, compartición de playlists y acciones especiales de YouTube/Noticias siguen perteneciendo al flujo Convex hasta migrar sus respectivos contratos y permisos.
