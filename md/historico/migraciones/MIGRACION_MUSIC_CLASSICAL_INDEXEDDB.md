# Shopp · Music Playlist y Classical Music en IndexedDB

**Ámbito:** Expo Web / PWA (Safari, Chrome y otros navegadores compatibles con IndexedDB). El build nativo de Expo sigue usando su backend anterior; IndexedDB es una API del navegador.

## Qué cambia

- Music Playlist y Classical Music leen y escriben **siempre** en IndexedDB al abrir la PWA. Una colección vacía es válida; nunca se vuelve a Convex silenciosamente.
- Creación, edición, borrado, reordenación, selección de Compartidos, lectura y edición de LRC e importación/exportación de playlists usan almacenamiento local.
- El botón **Migrar desde Convex** ejecuta, **solo tras confirmación**, una consulta puntual y descarga las LRC disponibles. La operación combina sin borrar datos previos ni alterar Convex.
- Las importaciones de copia completa v2 ZIP/JSON admiten combinar y reescribir una colección. Playlists y LRC se confirman en una sola transacción IndexedDB; la otra colección se conserva.
- La pantalla de intercambio P2P toma las playlists de IndexedDB y almacena allí las recibidas. **Convex sigue utilizándose para autenticación, permisos, presencia, emparejamientos y señalización WebRTC**; no para persistir playlists P2P.
- El menú de exportación general también exporta Music/Classical desde IndexedDB (incluso si están vacías), sin consultar Convex.
- Se eleva de versión 2 a **3** la base compartida `shopp-local-storage`. Sus tres módulos de apertura garantizan que existan `entries`, `playlists` y `playlist-migrations`, sin borrar registros existentes.

## Aplicación

1. Mantén una copia de seguridad del proyecto y trabaja en `develop`. Este ZIP contiene **solo** los archivos modificados; no es el proyecto completo.
2. Extrae la raíz del ZIP en tu proyecto conservando la estructura `src/` y sobrescribe únicamente los archivos indicados.
3. El código parte de la revisión `shopp-main (3)(3).zip`, con los cambios de `shopp-convex-a-local-fase4c.zip`. El ZIP de ajuste visual `v12` afecta a `PlaybackProvider.js` y **no se modifica aquí**. Si en tu rama los archivos han cambiado después, compara antes de sobrescribirlos.
4. Reinicia el servidor de Expo/Web, abre Music Playlist y Classical Music. Con datos IndexedDB vacíos, utiliza **Migrar desde Convex** una sola vez, o **Importar** una copia completa v2 ZIP/JSON previamente exportada.
5. **No elimines las playlists de Convex** hasta verificar número de colecciones, pistas, metadatos clásicos, reproducción, LRC y una exportación ZIP restaurable.
6. Cierra otras pestañas de Shopp si el navegador informa de que la actualización IndexedDB está bloqueada.

## Comprobación funcional obligatoria

- Crea una playlist Music, añade single y álbum; guarda, edita, reordena y borra. Repite con Classical y sus campos de compositor, intérprete, orquesta, etc.
- Importa y edita una LRC en la PWA; reproduce y confirma la sincronización de letra. Recarga la página y comprueba su persistencia. Verifica importación de LRC en iPad vertical.
- Exporta ambas colecciones desde su pantalla y desde el menú general, después importa de nuevo en otro navegador (o dispositivo) usando «Combinar» y «Reescribir todo».
- En el navegador, en DevTools > Application > IndexedDB > `shopp-local-storage`, verifica que aparecen las colecciones en `playlists` y las LRC en `entries`.
- Consulta Convex Dashboard > Usage antes y después de un período de uso **sin pulsar Migrar desde Convex ni abrir P2P**. No deberían producirse operaciones `api.playlists.*` originadas por esas pantallas. El consumo global de Convex puede continuar por autenticación y otras utilidades y no se puede atribuir a la reproducción sin inspeccionar los endpoints/consultas.
- Abre la utilidad P2P por separado: se mantienen operaciones de Convex **de señalización**, no de persistencia de playlists.

## Precauciones

- IndexedDB **no sincroniza** automáticamente entre Safari, Chrome, Mac, iPad ni distintos perfiles del mismo navegador. Debes exportar/importar ZIP para intercambiar o restaurar datos entre ellos.
- Los enlaces de YouTube siguen necesitando red. Offline aquí se refiere a la persistencia de playlists y LRC, no a descargar vídeo/audio de YouTube.
- No borres los datos del sitio, no navegues en modo privado para almacenamiento definitivo y realiza exportaciones ZIP periódicas. El navegador/sistema puede desalojar el almacenamiento local.
- Una importación v2 preserva una LRC local ya editada cuando encuentra otra diferente para el mismo vídeo; el resultado informa de los conflictos. La edición/eliminación de una LRC compartida por varias playlists del mismo navegador puede afectar a todas esas referencias, porque la clave se basa en el ID del vídeo o álbum.
- Las pruebas de esta entrega son de análisis sintáctico y auditoría de rutas de llamadas. **No se ha ejecutado aún una compilación Expo completa ni una prueba real en iPad/Safari o Chrome**.
