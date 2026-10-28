# Shopp — Sincronización musical: fase 5 (comparación sin escritura)

## Instalación
Requiere las fases 1–4. Extraer este ZIP en la raíz del proyecto. No desplegar a producción sin pruebas con una cuenta de prueba y respaldos de todos los dispositivos.

## Cambios
- `src/services/musicSync/compareVersions.js`: comparación de snapshots por IDs de pistas, orden, metadatos y registros LRC; sin escrituras.
- `src/screens/playlist/MusicSyncPanel.js`: botón **Comparar** para coincidencias locales/remotas y panel informativo.

## Límites importantes
- La comparación de letras depende de que `buildCompleteSnapshot` pueda leer las letras del dispositivo.
- IDs duplicados o canciones con identificadores inconsistentes necesitan auditoría previa.
- Carátulas locales no transferibles siguen bloqueando la construcción del snapshot.
- No se resuelven conflictos ni se sustituyen playlists. La coincidencia de datos no garantiza que ambos dispositivos estén sincronizados en futuras ediciones.
- Convex no es fuente de verdad automática: aún falta una estrategia de tres vías (base común, cambios locales y cambios remotos) y persistir revisiones locales verificadas.

## Prueba manual sugerida
1. Haz un respaldo JSON/ZIP por dispositivo.
2. Con una cuenta de prueba, abre Music Playlist > Sincronizar > Comparar con Convex.
3. En 'Requieren revisión', pulsa 'Comparar'. Verifica las diferencias sin ejecutar otras operaciones.
4. Verifica canciones añadidas, eliminadas, cambios de orden, metadatos y texto LRC.

## Siguiente fase
Persistencia de versión base y resolución de conflictos con vista previa, confirmación expresa y rollback.
