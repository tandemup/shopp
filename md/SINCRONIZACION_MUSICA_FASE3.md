# Sincronización musical, fase 3 (manual)

## Aplicación
Requiere los archivos de las fases 1 y 2. Copiar los archivos del ZIP a la raíz del repositorio.
No activar ningún botón ni sincronización automática todavía.

`completeTransfer.js` prepara snapshots con letras LRC de clave individual y carátulas pequeñas incrustadas (o enlaces HTTPS). Las carátulas locales, letras ausentes y paquetes grandes se rechazan: **no se pierde contenido silenciosamente**.

`uploadCompleteManual(client, api, id)` solo crea playlists que no existan en Convex (revisión 0); al recibir `conflict` no debe reintentarse sin conciliación. `previewRemoteComplete` revisa antes de importar. `importNewRemoteManual` solo importa IDs inexistentes en IndexedDB, y guarda playlists y LRC en una única transacción.

Se bloquea importación en la implementación nativa hasta disponer de persistencia atómica de letras. Los archivos que incluyan carátulas grandes requerirán Convex File Storage.

**Limitaciones**: la ausencia de letras en pistas con claves heredadas requiere una migración previa; no hay botón de UI, control automático de cambios, resolución de conflictos ni borrado remoto. Hacer copia de seguridad completa antes de probar. Requiere comprobación manual con dos cuentas/dispositivos y despliegue de Convex dev.
