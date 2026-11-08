# Shopp — Fase 1C: desacoplamiento del chat

## Alcance
- Las cuatro pantallas de chat dejan de importar directamente `convex/react` y `api.chat`.
- El adaptador Convex conserva la semántica de suscripciones y mutaciones.
- No se instala ni conecta Socket.IO. Convex sigue siendo el único backend operativo.
- La pantalla principal conserva el `skip` de mensajes al abrir Biblioteca, la consulta resumida limitada a las salas paginadas y los flujos multimedia.
- `ChatPrototypeScreen` utiliza `useCurrentUser` de la fase 1A.

## Instalación
Aplicar sobre el proyecto que ya contiene las fases 1A y 1B, conservando las rutas del ZIP.

## Pruebas
`node --test tests/backend-phase1a.test.mjs tests/backend-phase1b.test.mjs tests/backend-phase1c.test.mjs`

## Pruebas manuales pendientes
En web y móvil, probar salas predeterminadas y personalizadas, mensajes, borrado administrativo, subida de imágenes, álbumes y listas compartidas. Comprobar que Biblioteca no mantenga la suscripción del chat. Verificar chat de proximidad con geolocalización. No habilitar `EXPO_PUBLIC_BACKEND_PROVIDER=node`.

## Próximo paso
Definir protocolos REST/Socket.IO, permisos de autenticación y paginación antes de reemplazar el adaptador. El adaptador conserva los argumentos y datos en formato Convex durante esta fase; la normalización se abordará con migración backend.
