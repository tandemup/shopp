# Fase 9 — Coordinación manual protegida (experimental)

## Alcance
- `phase9Coordinator.js` orquesta copias, instalación local, CAS remoto, doble verificación y guardado de base confirmada.
- `guardedInstall.web.js` proporciona un CAS local transaccional para playlists **ya existentes** y LRC con claves individuales.
- La escritura remota ya existe en `convex/musicSync.js` (`uploadManual` con `expectedRevision`).

## Importante
Los adaptadores `io` no están conectados a la UI ni a la cuenta autenticada. Esta fase NO habilita el botón de aplicar fusión ni sincronización automática. Antes de conectar `applyManualMerge` deben validarse los datos con `assertApplyPreflight`, además de una revisión nueva de Convex, la copia de recuperación y el bloqueo de ediciones concurrentes.

`applyManualMerge` instala primero localmente y después escribe en Convex. No existe transacción distribuida entre IndexedDB y Convex. Si falla la escritura remota, devuelve `PARTIAL_REMOTE_ERROR` o `PARTIAL_REMOTE_CONFLICT`, conserva la copia de seguridad y **no intenta revertir automáticamente** los cambios locales. Se necesita una interfaz de recuperación y reconciliación antes de activarlo en producción. `PENDING_*` significa que NO está confirmada la sincronización.

`guardedInstall.web.js` no elimina LRC antiguas; es conservador para no afectar otras playlists. Rechaza claves duplicadas y cambios concurrentes. Pendiente: verificar contra almacenamiento real en Safari/iOS, añadir bloqueo entre pestañas, validar explícitamente snapshots de carátulas, resolver claves LRC compartidas y realizar tests integrados de cortes de red.

## Pruebas
`node --test tests/musicSync/phase9.test.mjs`

No sustituir archivos de fases anteriores: este ZIP es incremental.
