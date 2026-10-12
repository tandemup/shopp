# Shopp — Fase 11: diagnóstico local e importación JSON v1 atómica

## Alcance

Esta entrega es **incremental**, para instalar **después de las Fases 5 a 10**, sobre la misma revisión de `develop`. No es un proyecto completo. Contiene cuatro módulos JavaScript modificados y dos archivos de pruebas actualizados.

- `src/screens/playlist/PlayListScreen.js`: botón **Verificar datos** en Music y Classical y flujo de importación local v1 en lote.
- `src/storage/playlists/playlistRepository.web.js`: `auditLocalPlaylists(type)`, exclusivamente de lectura, y cierre de conexión en cambios de versión.
- `src/storage/lyricsStorage.web.js`: cierre de conexión en cambios de versión.
- `src/storage/indexedDbStorage.web.js`: cierre de conexión en cambios de versión.
- `tests/playlist-repository-atomicity.test.mjs`: pruebas de auditoría sin escrituras, lote v1 y aislamiento.
- `tests/playlist-local-convex-contract.test.mjs`: comprobaciones estáticas de que estos flujos no ejecutan operaciones Convex.

La importación JSON **v1** no puede recuperar letras que el formato antiguo no incorporaba: las pistas restauradas se marcan sin LRC, sin heredar letras antiguas de otros vídeos. Para respaldos con LRC utiliza ZIP/JSON **v2**. Ninguna importación elimina información guardada anteriormente en Convex.

## Instalación

1. Exporta y conserva los ZIP v2 de Music y Classical desde **cada navegador** que tenga datos (Safari/Chrome iPad, Mac), antes de desplegar.
2. En la rama `develop`, compara estos cuatro archivos con los de tu proyecto antes de sobrescribirlos. Las anteriores Fases 5–10 son requisitos; en especial, los cambios de maquetación de iPad deben mantenerse.
3. Descomprime el ZIP en la raíz de Shopp respetando los directorios `src/` y `tests/`.
4. Ejecuta `node --test tests/playlist*test.mjs`. Después, abre el despliegue de pruebas en Safari/Chrome e inicia las dos utilidades.

## Nuevo botón «Verificar datos»

Desde Music Playlist o Classical Music, pulsa **Verificar datos**. El informe muestra:

- Número de colecciones y pistas locales del tipo seleccionado.
- Cantidad de LRC declaradas, encontradas y faltantes; si hay faltantes, muestra hasta 10 pistas afectadas.
- Cantidad de claves LRC individuales huérfanas (revisando **ambas colecciones** para no contar como huérfanas las utilizadas por la otra).

El diagnóstico **no lee textos LRC**, no repara ni borra registros, no toca Convex y no realiza escrituras IndexedDB. Los residuos de claves antiguas compartidas por vídeo no se consideran automáticamente huérfanos: se preservan por compatibilidad. Una discrepancia debe investigarse antes de restaurar una copia.

## Comprobación práctica en iPad y Mac

1. Crea/edita/borra una colección Music con una LRC, cambia la letra, exporta ZIP v2, recarga el navegador, comprueba la sincronización y ejecuta **Verificar datos**.
2. Repite en Classical, usando incluso el mismo vídeo de YouTube. Las letras deben ser independientes.
3. Importa un respaldo JSON v1 de varias playlists en modo Combinar y repítelo: la segunda importación debe omitir duplicados. Comprueba que Classical no se modifica durante la importación de Music. El modo Reemplazar debe sustituir únicamente la colección elegida.
4. Abre la misma PWA en dos pestañas y recarga tras instalar una versión nueva; las conexiones IndexedDB antiguas se liberarán ante una actualización de esquema. Si una pestaña sigue bloqueando la actualización, ciérrala y reintenta.
5. Comprueba las LRC y las playlists al volver a abrir el navegador. Verifica también que Safari y Chrome mantienen sus almacenes independientes.
6. Para P2P, prueba Mac ↔ iPad con ambas sesiones en Fase 9 o posterior y comprueba la confirmación de guardado.

## Auditoría de Convex (pendiente de ejecución en un despliegue real)

1. En Convex Dashboard del deployment usado por la PWA, abre **Logs** y toma la hora y una captura **antes** de las pruebas.
2. Sin entrar en P2P ni pulsar «Migrar desde Convex», utiliza Music y Classical: crear, editar, reordenar, cambiar una LRC, reproducir, exportar, importar y borrar.
3. Revisa llamadas a `playlists.*` y operaciones de **Storage** relacionadas con LRC durante ese intervalo. El objetivo para estas utilidades web es **cero operaciones Convex atribuibles a ellas**.
4. Prueba por separado **Migrar desde Convex** (consulta remota explícita) y **P2P** (Convex sigue prestando señalización/autenticación). No mezcles sus eventos con el ensayo de uso habitual.
5. Si hay alguna llamada indebida, registra su nombre, hora, operación reproducida y captura del log, para localizar la fuente. Las consultas de usuarios, tiendas u otras utilidades pueden continuar aunque las playlists ya sean locales.

**Límites**: esta fase no valida el funcionamiento en un iPad real ni certifica métricas de un despliegue Convex; hacen falta ambas comprobaciones. IndexedDB corresponde a la versión **web/PWA**; Expo nativo mantiene el backend previo. Los vídeos de YouTube requieren Internet.

## Pruebas de esta entrega

- `node --test tests/playlist*test.mjs`: **40/40** correctas, incluyendo 3 nuevas.
- `node --test tests/*.test.mjs`: **48/50** correctas. Persisten los dos fallos anteriores (diálogos: import en cargador de tests; escaneo: categoría Supermercado no encontrada).
- Análisis de sintaxis con parser TypeScript/JSX de los cuatro módulos: **0 errores**.
- La prueba Chromium headless incluida previamente en `tests/indexeddb-playlists-browser.mjs` no consiguió completar en este entorno. **No se considera una validación real de navegador**.
