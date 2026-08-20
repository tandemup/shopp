# Auditoría de limpieza y duplicidades

## Restos a revisar

| Elemento | Evidencia | Acción |
|---|---|---|
| Música | Dependencias/documentación o restos heredados | Eliminar completamente |
| Google Drive | Referencias en documentación/contacto | Retirar referencias |
| Socket.IO/Heroku | `.env.example`, `deno.lock`, `md/heroku.md` | Retirar si Chat usa exclusivamente Convex |
| CarrefourTestScreen | Pantalla de prueba en navegación | Sacar de producción |
| GPS Debug | Ruta y funciones backend heredadas | Dejar solo para administradores |
| Audio | `expo-av` y `messageTone.mp3` | Confirmar necesidad; eliminar si no se usa |

## Duplicidades detectadas

- Almacenamiento: `storage.js`, adaptadores web/native, IndexedDB y storages específicos.
- Distancias: `utils/math`, `utils/store` y `utils/helpers`.
- Rehash de tiendas: `utils/helpers/rehashStores.js` y `utils/tools/rehashStores.js`.
- Mapas: `features/maps/mapTiles.js` y `features/maps/snippets/mapTiles.js`.
- Scanner: flujo básico, principal, rápido, unificado y auxiliares.
- Búsquedas Google: `googleProductSearch.js`, `productSearchEngines.js` y lógica en pantallas.
- Alertas: `components/ui/alert` y `utils/ui`.
- Zoom del scanner: dos implementaciones de almacenamiento.

## Orden seguro

1. Retirar documentación y referencias obsoletas.
2. Sacar de navegación pantallas de prueba/debug.
3. Unificar módulos y actualizar imports.
4. Revisar dependencias con `rg` y `npm ls`.
5. Ejecutar `npm run build` y probar login, listas, tiendas, scanner, chat y parking.
6. Revisar tablas remotas Convex por separado; quitar código no borra tablas automáticamente.

Este documento identifica candidatos; no ejecuta borrados.
