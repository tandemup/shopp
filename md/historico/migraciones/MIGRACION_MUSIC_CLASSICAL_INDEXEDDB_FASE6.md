# Shopp · Fase 6 · Persistencia local y letras LRC

## Alcance y base

Este ZIP es **incremental sobre la Fase 5** (`shopp-music-classical-indexeddb-fase5.zip`), no sustituye al proyecto completo. Contiene solo cuatro archivos JavaScript modificados, dos scripts de pruebas y este documento. Aplicar sobre la rama `develop` con copia previa. Si has editado estos mismos archivos desde la Fase 5, compara las diferencias antes de sobrescribir.

**Ámbito:** Music Playlist y Classical Music de la PWA (Expo Web). No cambia el backend de News, Tutorials, Auth o P2P. El cliente Expo nativo conserva su implementación previa.

## Cambios

1. **Exportación 100 % local de LRC:** se prefiere IndexedDB. En modo PWA local nunca se solicita una LRC a Convex ni se consulta el almacenamiento remoto como fallback. Si el registro declara una letra pero falta su contenido local, la exportación se cancela para evitar una copia incompleta. Los ZIP no conservan `lyricsStorageId`, `lyricsUri` ni `lyricsUrl` de Convex.
2. **Migración desde Convex exclusivamente a petición del usuario:** el botón «Migrar desde Convex» permite descargar LRC remotas (a través de su URI existente). La versión local gana cuando ambas están presentes.
3. **Guardar playlist y LRC en una única transacción IndexedDB:** al confirmar «Guardar» en el editor principal, se graban metadatos, pistas y letras en una sola transacción. Un fallo revierte todo; la edición/retirada de letras en la ventana secundaria queda pendiente hasta ese momento.
4. **Cambiar el vídeo de una pista desvincula una LRC anterior:** evita asignar a un vídeo diferente las letras de la canción anterior. La entrada antigua no se elimina automáticamente al cambiar la URL, por si la utilizan otras playlists.
5. **Selección de origen sin fallback oculto:** el menú general exporta Music y Classical locales por defecto; las demás utilidades conservan su funcionamiento.

## Pruebas automatizadas

Ejecutar desde la raíz del proyecto:

```bash
node --test tests/playlist-backup-local.test.mjs
```

Los cuatro tests pasaron en el entorno de preparación. Cubren copia sin red, preservación LRC local, error ante LRC ausente y migración explícita de LRC remota.

Se incluye además una prueba de integración con Chromium, que requiere acceso al ejecutable del navegador:

```bash
node tests/indexeddb-playlists-browser.mjs
```

Cubre actualización de esquema v2 → v3 con preservación de letras, CRUD por colección, aislamiento Music/Classical, atomicidad y exportación local. **No se ha podido ejecutar en el entorno de preparación porque Chromium headless se bloquea; su resultado está pendiente.** No debe confundirse con una prueba aprobada.

En la batería general preexistente, `node --test tests/*.test.mjs` dio **12 pruebas correctas y 2 fallos**: uno en `dialog-behavior.test.mjs` por el cargador de imports y otro en `scanned-product-flow.test.mjs` por un campo `category` esperado. No son componentes modificados por este ZIP y no se han corregido en esta fase.

## Comprobación manual previa a producción

1. Hacer backup ZIP de Music Playlist y Classical Music en la versión que funciona antes de aplicar el ZIP. Verificar que el contenido LRC está incluido en `playlist.json` y en la carpeta `lyrics/`.
2. Aplicar Fase 5 y después Fase 6. Reiniciar Expo/Netlify para servir el código nuevo.
3. En un navegador de pruebas, migrar **una vez** desde Convex o restaurar las copias ZIP. Abrir una playlist, editar una letra, cancelar la edición principal y confirmar que el texto persistido no cambia. Repetir guardando la playlist y confirmar que sí cambia.
4. Crear, editar, reordenar, borrar y exportar una playlist Music; repetir con Classical y comprobar compositor, intérprete, director, orquesta, periodo y año. Verificar que una eliminación en Music no borra Classical.
5. Reproducir una pista con LRC y comprobar sincronización visual; cerrar y reabrir Safari/Chrome y recargar para verificar persistencia. Probar en iPad vertical y horizontal.
6. En DevTools → Application → IndexedDB → `shopp-local-storage`, comprobar `playlists`, `entries` y `playlist-migrations`. Comprobar también que exportar nunca descarga LRC de Convex.
7. En Convex Dashboard → Logs/Usage, comparar sesiones de uso normal **sin migración ni P2P**. Verificar que no se invocan funciones `api.playlists.*`. El consumo total de Convex puede continuar por autenticación u otras funcionalidades y no es una medida aislada de Music/Classical.

## Limitaciones

- Safari, Chrome y cada dispositivo conservan IndexedDB independiente: no hay sincronización automática. Mantener copias ZIP regulares y no eliminar los originales Convex hasta verificar restauración íntegra.
- La reproducción de YouTube precisa acceso a YouTube; el almacenamiento local no descarga los vídeos o audios.
- Una LRC se identifica por vídeo/álbum y puede ser compartida por varias playlists. Borrarla explícitamente desde una playlist puede afectar a otras que referencien el mismo vídeo. El cambio de URL no borra la anterior automáticamente.
- P2P mantiene Convex para señalización/autorización. La transferencia P2P de playlists no transporta todavía las letras LRC; para transferirlas entre dispositivos, utilizar el ZIP v2.
- Pendiente: validación funcional en Safari/Chrome de iPad, compilación Expo web completa y auditoría real de Usage en Convex.
