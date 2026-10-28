# Sincronización Music / Classical — fase 1 (preparación segura)

## Estado

- La PWA utiliza IndexedDB (`shopp-local-storage`, versión 3), almacén `playlists`, con `entries` para LRC.
- En dispositivos nativos, el origen actual sigue siendo Convex; esta fase **no unifica** los dos modelos.
- `convex/youtubePlaylists` es el modelo antiguo y no debe emplearse para sobrescribir las playlists locales.
- Se añadió `musicSyncPlaylists`, una tabla separada y vacía por defecto, indexada por propietario y ID local.
- Se añadió `musicSync.inventory`, consulta de solo lectura protegida con autenticación, que rechaza usuarios anónimos.
- Se añadió `inspectLocalMusic()`, inventario local sin escrituras ni transferencias; incluye auditoría de claves LRC.

## Precauciones

**La sincronización no está activada.** No se ha conectado ningún disparador a los guardados, y no se suben datos a Convex.
El valor `v.any()` del snapshot es provisional: antes de incorporar escrituras hay que fijar validación de tamaño, forma de payload, cuotas, y controles de permisos.
El modelo debe contemplar archivos LRC almacenados en `entries`, carátulas locales, bajas lógicas e IDs estables.

## Pasos para la fase 2

1. Exportar backup JSON/ZIP en Mac, iPhone e iPad antes de la primera sincronización.
2. Revisar el inventario de cada dispositivo, especialmente IDs iguales con contenido diferente.
3. Definir protocolo de cambios con idempotencia y revisión esperada; sin `replaceAll` durante la reconciliación.
4. Integrar operaciones atómicas de cola local en IndexedDB junto a `saveWithLyrics`, `update` y `remove`.
5. Incorporar endpoint de escritura autenticado, límites de tamaño, resolución de conflictos y transmisión de LRC.
6. Probar la migración en entorno dev con copias, antes de activar el modo automático en producción.

## Pruebas

`node --test tests/playlist-repository-atomicity.test.mjs`
