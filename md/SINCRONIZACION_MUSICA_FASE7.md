# Shopp · Fase 7: bases confirmadas y precondiciones de fusión

## Alcance entregado

- `confirmedBase.web.js`: almacenamiento IndexedDB **separado** por cuenta/colección/ID, con versión y copia de snapshot+LRC; no altera la base de playlists.
- `confirmedBase.native.js`: bloquea hasta que exista una implementación nativa segura.
- `mergeGuards.js`: comprueba identidad, integridad de la base, revisión remota y evita aplicar una vista previa obsoleta.
- `mergeGuards.mjs`: equivalente para ejecutar pruebas Node ESM.

## MUY IMPORTANTE: esta fase NO activa una aplicación bidireccional

No existen aún escrituras automáticas ni se ha conectado el guardado de bases a la interfaz. **No llames a `saveConfirmedBase` inmediatamente tras descargar o subir una playlist**: una base exige que ambos extremos contengan la misma versión, que una copia de seguridad haya quedado persistida y que la revisión esté confirmada. Estas operaciones deberán componerse en un coordinador posterior que tolere fallos parciales.

El registro independiente tampoco es transaccional con el almacén de playlists. Para evitar falsos puntos comunes, se exige una verificación de extremo a extremo antes de guardar una base; un coordinador futuro deberá comprobar de nuevo el contenido en cada uso.

## Ejecución

```bash
node tests/musicSync/phase7.test.mjs
node tests/musicSync/threeWayMerge.test.mjs
```

## Pendiente antes de permitir aplicar fusiones

1. Copia persistente de la versión local anterior y letras LRC, con opción restaurar.
2. Verificación de contenido idéntico tras instalar la revisión confirmada en local.
3. Guardar base **solo** después de la verificación, vinculada a la identidad autenticada.
4. Mutación Convex compare-and-swap con revisión esperada y paquete completo.
5. Revalidación del contenido local antes de aplicar, rollback y recuperación de fallos parciales.
6. Resolver carátulas no portables y soporte nativo.
7. Pruebas de integración de Mac/iPad/iPhone, offline, doble pestaña y cambio de cuenta.

Se recomienda trabajar en `develop`, nunca aplicar directamente a `main`.
