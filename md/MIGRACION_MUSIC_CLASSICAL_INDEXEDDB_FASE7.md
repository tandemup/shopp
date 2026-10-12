# Shopp · Fase 7 · Aislamiento LRC y cero acceso rutinario a playlists Convex

## Instalación

Este paquete es **incremental** sobre las fases 5 y 6, no una distribución completa de Shopp. Trabajar en `develop`, con copia de seguridad de los ZIP v2 de Music y Classical **antes** de sustituir archivos. Descomprimir en la raíz del proyecto conservando `src/` y `tests/`. Si tienes cambios posteriores en cualquiera de estos archivos, comparar y combinar manualmente.

Orden: proyecto en `develop` → aplicar Fase 5 → aplicar Fase 6 → aplicar Fase 7 → reiniciar Expo Web y desplegar una vista previa de Netlify antes de producción.

## Correcciones

1. **LRC por pista:** al guardar una LRC nueva o editar una antigua se escribe en una clave exclusiva `@shopping/playlist-lyrics/track:<id>`. El mismo vídeo puede figurar en varias playlists, Music o Classical, con letras distintas. Las antiguas letras que estaban almacenadas por ID de vídeo se siguen leyendo hasta que se guarden con la clave nueva, y **nunca se sobrescriben por las operaciones nuevas**.
2. **Borrado seguro:** quitar LRC, eliminar una playlist, sustituir una colección o retirar una pista elimina sus LRC individuales huérfanas en la misma transacción IndexedDB. No se elimina una clave todavía referenciada por otra lista. Las letras antiguas compartidas por vídeo no se eliminan automáticamente.
3. **Respaldo portable:** ZIP v2 contiene las letras y metadatos, pero no transporta las claves locales `lyricsKey` ni los IDs/URLs de almacenamiento Convex. Restaurarlo genera claves locales independientes incluso si dos playlists usan el mismo vídeo.
4. **Importación sin contaminación:** si un respaldo o P2P v1 no contiene letra para una pista, no se adjunta una antigua LRC local cuyo vídeo coincida.
5. **Reproductor:** Music/Classical en la PWA no utiliza las antiguas URLs remotas de letras como alternativa a IndexedDB; Tutoriales/Noticias mantienen su comportamiento previo. El vídeo/albúm sigue necesitando acceso a YouTube.
6. **Consulta Convex:** Music/Classical usan IndexedDB en la PWA. `api.playlists.listMine` solo se consulta por acción explícita «Migrar desde Convex». P2P sigue utilizando Convex para presencia, invitación y señalización WebRTC; autenticación y otras utilidades de Shopp también pueden consumir Convex.
7. **Compatibilidad nativa:** el módulo `lyricsStorage.js` expone también el constructor de clave local que importa `PlayListScreen`. La migración local solo está activada en Expo Web; no se transforma la persistencia del cliente nativo en esta fase.

## Pruebas ejecutadas

Desde la raíz:

```bash
node --test tests/playlist-backup-local.test.mjs tests/playlist-lyrics-isolation.test.mjs tests/playlist-repository-atomicity.test.mjs
```

**13/13 OK**. Incluyen exportaciones que no hacen `fetch`, independencia de claves, importación y eliminación transaccional en repositorio IndexedDB simulado. **No equivalen a una prueba en el motor IndexedDB de Safari o Chrome**. Los nueve JS modificados pasan el análisis sintáctico de TypeScript/JSX (`transpileModule`).

La batería general `node --test tests/*.test.mjs` del proyecto original tiene dos fallos preexistentes e independientes: uno en los diálogos (`dialog-behavior.test.mjs`, resolución de imports) y otro en escaneo (`scanned-product-flow.test.mjs`, `category`). En el último pase, **18/20** superaron las pruebas; al añadir la suite de repositorio debe esperarse **21/23** si esos dos fallos persisten.

`node tests/indexeddb-playlists-browser.mjs` contiene la prueba de integración actualizada con Chromium, pero este navegador se bloquea en el entorno utilizado y el resultado **no está certificado**. La compilación completa Expo no se ha ejecutado porque este árbol de trabajo no tiene `node_modules`.

## Comprobación en el dispositivo

1. Antes de instalar: exportar ZIP de Music y Classical, confirmar que contienen `playlist.json` y las LRC. **No borrar los datos de Convex**.
2. Abrir una instalación de prueba en Safari/Chrome: crear Music con vídeo YouTube + LRC y crear Classical con el **mismo vídeo**, pero distinta LRC. Reproducir ambas, comprobar texto y tiempos.
3. Cambiar solo la LRC de Music y recargar la PWA: Classical debe conservar su versión; la de Music debe persistir. Borrar la LRC de Music y comprobar que no reaparece la anterior.
4. Borrar Music o sustituir la colección Music mediante importación: Classical y su LRC deben conservarse. Restaurar ambos ZIP en un navegador diferente y verificar el contenido.
5. En DevTools → Application/Storage → IndexedDB → `shopp-local-storage` inspeccionar `playlists` y `entries`. Las LRC nuevas deben usar `track:<id>`, las antiguas `video:<id>` podrán coexistir temporalmente.
6. Desde la página Convex Dashboard → Logs/Usage, comparar dos sesiones aisladas de Music/Classical sin pulsar «Migrar» ni entrar en P2P; no deben aparecer invocaciones `api.playlists.*`. Pueden aparecer otras funciones de autenticación o de otras utilidades.
7. Repetir en iPad Safari/Chrome, tanto vertical como horizontal, y tras cerrar y reabrir la pestaña.

## Límites y precauciones

- Los datos de IndexedDB son **por navegador y origen web**; no se sincronizan automáticamente entre dispositivos. Las copias ZIP son obligatorias antes de limpiar datos de Safari/Chrome, cambiar dominio o usar navegación privada.
- Las letras antiguas compartidas por vídeo no se destruyen; esto protege datos de otras playlists. Al editar y guardar una lista se crea su propia LRC y se aísla a partir de ese momento.
- La transferencia P2P v1 de playlists todavía **no incluye las LRC**; usar exportación/restauración ZIP v2 para transferirlas. P2P seguirá generando operaciones de Convex de **señalización**, incluso aunque las playlists se lean/escriban desde IndexedDB.
- No se ha medido aún una sesión real en Convex Usage, por lo que la ausencia total de llamadas `api.playlists.*` está validada solo por inspección y pruebas estáticas, no por telemetría de producción.
