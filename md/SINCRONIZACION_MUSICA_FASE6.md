# Fase 6 — Propuesta de fusión a tres vías, solo lectura

## Alcance

Se añade `src/services/musicSync/threeWayMerge.js` sin cambiar la pantalla o activar escrituras. Utiliza tres paquetes completos `{snapshot, lyrics}`: última versión sincronizada **confirmada** (`base`), versión local y versión remota. Una comparación de dos versiones no sirve para inferir eliminaciones.

### Ejemplo de uso

```js
import { planThreeWayMusicMerge } from '@/src/services/musicSync/threeWayMerge';
const plan = planThreeWayMusicMerge({ base, local, remote });
if (plan.conflicts.length) {
  // Mostrar conflictos para elección explícita, no aplicar plan.proposal.
}
```

La fase 6 **no persiste** la versión base, no sustituye entradas en IndexedDB/AsyncStorage, no actualiza Convex ni añade un botón de fusión. `canApply` siempre es `false` por diseño. La `proposal` es un borrador no autorizado para grabar. El llamador no debe escribirla en ninguna base de datos.

## Qué falta para la fase 7

1. Guardar por cuenta/dispositivo una versión base íntegra y confirmada, con revisión y LRC.
2. Exponer una pantalla de resolución explícita para cada conflicto, preservando los dos originales y el base.
3. Implementar una transacción local de reemplazo seguro (con backup y compare-and-swap local), y una mutación Convex con `expectedRevision` comprobada.
4. Revalidar la revisión remota después de mostrar la vista previa, evitando estados obsoletos.
5. Probar con tres dispositivos, sincronización offline, eliminaciones, cambios de orden, letras y carátulas.

## Limitaciones

- Los `track.id` o `videoId` deben ser únicos y estables; no se utiliza el índice de la pista como identidad.
- Si ambos lados alteran el orden, se muestra conflicto incluso cuando pudiese haber una combinación automática; es la opción conservadora.
- Las adiciones nuevas en ambos lados producen conflicto de orden cuando sus secuencias difieren.
- `updatedAt` y campos de sincronización son metadatos efímeros y no participan en la comparación.
- El motor no descarga imágenes ni garantiza transferibilidad de carátulas grandes.
