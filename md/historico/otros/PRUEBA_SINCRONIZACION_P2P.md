# Shopp · prueba de sincronización P2P de Biblioteca

Cambios principales:

- Dos dispositivos con la misma cuenta pueden aparecer como peers distintos.
- Cada navegador conserva un `deviceId` local en `localStorage`.
- La Biblioteca local se sincroniza por WebRTC `RTCDataChannel`.
- El JSON se divide en bloques de 48 KiB para Bibliotecas grandes.
- Sincronización bidireccional: el receptor combina y devuelve su estado actualizado.
- Conflictos de enlaces: gana el registro con `updatedAt` más reciente.
- Los enlaces archivados también se transfieren como tombstones para propagar eliminaciones.
- Convex se usa para presencia/señalización; los datos de Biblioteca viajan directamente P2P.

## Antes de probar

Este ZIP modifica el esquema y las funciones Convex. Despliega/actualiza Convex antes de probar la PWA:

    npx convex dev

Para producción, usa el flujo habitual de deploy de Convex del proyecto.

## Prueba MacBook ↔ iPad

1. Abre Shopp en ambos dispositivos con la misma cuenta.
2. En ambos entra en `Intercambio P2P`.
3. Escribe nombres distintos, por ejemplo `MacBook` e `iPad`.
4. Pulsa `Activar intercambio cerca` en los dos.
5. Desde uno, invita al otro y verifica el mismo código en ambos.
6. El iniciador pulsa `Conectar ahora`.
7. Cuando aparezca `Canal P2P conectado`, pulsa `Sincronizar Biblioteca`.
8. Espera a que se combinen los cambios y comprueba Biblioteca en ambos dispositivos.

## Ficheros modificados

- `convex/schema.js`
- `convex/nearbyShare.js`
- `src/services/libraryJsonApi.js`
- `src/screens/playlist/P2PPlaylistExchangeScreen.js`
