# Sincronización Music / Classical — fase 2 (protocolo manual seguro)

## Qué se ha añadido

- `convex/musicSync.js`: inventario, lectura de snapshot por cuenta y mutación manual `uploadManual` con compare-and-swap (`expectedRevision`).
- `src/services/musicSync/manualSync.js`: `previewManualSync` detecta playlists solo locales, solo remotas y coincidencias que requieren revisión.
- `uploadNewPlaylistManual` permite subir **solo playlists sin LRC** bajo una acción explícita; nunca reemplaza un ID existente (revisión esperada 0).
- No se han conectado botones ni disparadores automáticos; ninguna acción se ejecuta con solo abrir una pantalla.

## Limitaciones intencionadas

1. Los snapshots Convex no transportan todavía las entradas LRC de IndexedDB ni carátulas binarias. Se bloquea la subida de playlists con metadatos LRC en el helper.
2. No hay todavía fusión ni descarga automática. **No usar `replaceAll`** con datos recibidos del servidor.
3. Dispositivos nativos utilizan AsyncStorage; IndexedDB solo en web.
4. Las operaciones concurrentes detectan revisión distinta y devuelven `status:'conflict'`. El cliente debe mostrar el conflicto al usuario.
5. Hacer respaldos por dispositivo y revisar autenticación/permisos en entorno de desarrollo antes de exponer una interfaz de sincronización.
6. `uploadManual` es una API de bajo nivel para clientes autenticados; su uso seguro requiere validación funcional adicional de snapshots, LRC y políticas de cuota.

## Próxima fase

Implementar importación no destructiva con conflictos explícitos y empaquetado conjunto de LRC/carátulas, pruebas de dos dispositivos y UI manual de revisión y confirmación.
