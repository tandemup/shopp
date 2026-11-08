# Migración del backend — Fase 1A

## Alcance

Se ha creado una capa mínima de selección del backend y `useCurrentUser`.
**Convex sigue siendo el único proveedor implementado.** No se modifica el modelo de datos,
la autenticación, la Biblioteca local, las playlists, las tarjetas públicas o Netlify.

Archivos incorporados: `src/api/config.js`, `src/hooks/useCurrentUser.js`.
Archivos adaptados: `App.js`, `src/context/ListsContext.js`, `.env.example`.

## Configuración

En `.env.local` dejar `EXPO_PUBLIC_BACKEND_PROVIDER=convex` y conservar
`EXPO_PUBLIC_CONVEX_URL` existente. Si no se define el proveedor, se adopta
`convex` para garantizar retrocompatibilidad. El valor `node` muestra un error
expreso: **no habilita un backend incompleto**.

La URL pública del futuro servidor Node se reservará en `EXPO_PUBLIC_API_URL`.
No almacenar secretos en variables `EXPO_PUBLIC_*`.

## Verificación

1. Ejecutar `node --test tests/backend-phase1a.test.mjs`.
2. Ejecutar `npx expo start --web --clear` y verificar sesión, invitado y listas.
3. Verificar en iPad/iPhone que las listas locales persisten igual que antes.
4. Comprobar que el acceso QR público existente sigue funcionando.
5. Verificar la ausencia de errores nuevos en consola.

## Próxima entrega

Contratos de datos e interfaces de proveedor para Tiendas y Listas, sin asumir
que las consultas reactivas de Convex equivalen a `fetch`.
