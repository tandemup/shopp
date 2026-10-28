# Fase 8 — Preparación de aplicación y recuperación (seguridad primero)

## Alcance real

Esta fase introduce **verificaciones previas a una eventual aplicación** y un **almacén separado de copias de recuperación** en IndexedDB para la PWA. NO aplica fusiones, NO modifica las playlists actuales, NO hace escrituras Convex y NO activa sincronización automática. Estos módulos todavía NO están conectados a los controles de Music Playlist ni Classical.

## Archivos

- `src/services/musicSync/applyGuards.js`: verifica cuenta, colección, ID, versión base confirmada, revisión remota, conflictos, LRC y carátulas locales; exige confirmación explícita. Devuelve `PREPARED_ONLY`, no autoriza por sí mismo escribir.
- `src/services/musicSync/recoveryVault.web.js`: almacén independiente `shopp-music-sync-recovery` con snapshots duraderos de playlist + LRC, lectura de verificación y previsualización de restauración con control de identidad. No modifica `shopp-local-storage` ni actualiza su versión.
- `src/services/musicSync/recoveryVault.native.js`: falla cerradamente. No se proclama soporte en AsyncStorage.
- `tests/musicSync/phase8.test.mjs`: diez pruebas unitarias de guardas; no son pruebas de IndexedDB ni Convex.

## Pruebas

`node --test tests/musicSync/phase8.test.mjs`

## Secuencia obligatoria antes de implementar la aplicación real

1. Autenticar y comprobar propietario de la playlist en Convex.
2. Leer snapshot local y LRC reales; crear copia duradera y verificar lectura íntegra en IndexedDB. Exportar además JSON/ZIP para recuperación ante borrado del navegador.
3. Leer remoto con revisión actual, comprobar base confirmada de la fase 7, ejecutar planificación de fusión de fase 6 y resolver todos los conflictos.
4. Obtener confirmación explícita; justo antes de escribir, ejecutar preflight y verificar de nuevo versión remota.
5. Implementar una mutación Convex CAS atómica que valide propietario, revisión y tamaño del payload. **No** simular CAS con lectura y escritura separadas.
6. Implementar sustitución local de playlist + LRC en una transacción IndexedDB que compare la versión local esperada, y recuperación comprobada tras fallos.
7. Marcar base sincronizada solo cuando remoto y local son consistentes. Si falla el paso local después de Convex, conservar estado pendiente de conciliación: nunca declarar éxito.
8. Probar desconexión, doble pestaña, edición simultánea, fallo entre pasos, cierre de sesión, invitado y restauración efectiva entre Mac/iPad/iPhone.

## Advertencias

IndexedDB puede ser borrado por el navegador; la copia local **no sustituye** un respaldo ZIP fuera del dispositivo. Las fotos con URL `blob:`/`file:`/`content:` no pueden considerarse sincronizadas. Se mantiene desactivada cualquier acción destructiva en producción.
