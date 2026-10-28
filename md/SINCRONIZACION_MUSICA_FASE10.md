# Fase 10 — Diario persistente y diagnóstico de recuperación

## Archivos
- `src/services/musicSync/incidentJournal.web.js`: diario IndexedDB separado por cuenta, playlist y colección; operaciones `registerSyncIncident`, `readSyncIncident`, `listSyncIncidents`. Nunca escribe en las playlists.
- `src/services/musicSync/reconcileIncident.js`: diagnóstico **solo lectura** de una incidencia comparando copia previa, estado local, estado remoto y propuesta.
- `src/services/musicSync/reconcileIncident.mjs`: módulo idéntico para pruebas Node.
- `tests/musicSync/phase10.test.mjs`: diez pruebas unitarias de protección.

## Integración segura
1. Antes de cualquier futura operación de escritura, crear y verificar `createRecoverySnapshot` (fase 8).
2. Registrar incidencia con `registerSyncIncident` y guardar el ID en la operación coordinada. El registro debe completarse ANTES de iniciar escritura.
3. Solo después de obtener ambos snapshots completos (incluyendo LRC) y una revisión remota verificable, ejecutar `assessSyncIncident`.
4. El resultado es una **recomendación de revisión**. No debe disparar ninguna escritura ni marcar automáticamente una base confirmada.

## Estados
- `READY_FOR_CONFIRMATION_REVIEW`: estados iguales a propuesta; comprobar autenticación, checkpoint y revisiones antes de confirmar.
- `MANUAL_REMOTE_RETRY`: local modificado, remoto en revisión previa. Necesita consentimiento y nuevo CAS remoto.
- `MANUAL_LOCAL_REPAIR`: remoto actualizado, local en versión anterior. Necesita CAS local y consentimiento.
- `BLOCKED_NEW_REMOTE_REVISION`: remoto cambió de nuevo; recomparar.
- `BLOCKED_DIVERGENCE`: conservar ambos estados; resolver manualmente.
- `BLOCKED_UNAVAILABLE`, `BLOCKED_INCOMPLETE_LRC`, `BLOCKED_NO_PROPOSAL`: no hay datos suficientes para reparar.

## Limitaciones conocidas y bloqueantes
- **No está conectado a los botones de la pantalla**; se trata de módulos incorporables, no de sincronización funcional lista para producción.
- `convex/musicSync.js` del paquete anterior guarda `snapshot` pero no ofrece aún la lectura/escritura atómica de `lyrics` separadas requerida por el coordinador. Es imprescindible ampliar ese contrato y probarlo antes de habilitar la escritura.
- La escritura local de fase 9 usa transacciones IndexedDB que requieren revisión de compatibilidad en Safari/iOS, con pruebas reales de concurrencia y recuperación.
- No existe transacción distribuida IndexedDB/Convex; el diario NO la sustituye.
- El diario está almacenado localmente; limpiar datos del sitio también puede eliminarlo. Los respaldos de exportación externos son necesarios.
- El módulo no soporta nativo/AsyncStorage; la web puede usar IndexedDB.
- La comparación actual usa serialización JSON canónica; la integración debe normalizar el formato real de snapshots/lyrics y comprobar que no se ha alterado.

## Pruebas
Desde la raíz:
`node --test tests/musicSync/phase10.test.mjs`

## Próximo paso
Probar el contrato remoto completo en Convex dev con letras LRC; instrumentar pruebas end-to-end de la base local en navegador y una interfaz de incidencias pendiente, antes de activar aplicación efectiva, sincronización automática o restauración.
