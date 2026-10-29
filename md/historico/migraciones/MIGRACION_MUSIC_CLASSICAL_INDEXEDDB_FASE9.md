# Shopp · Fase 9 · Confirmaciones de guardado P2P y controles de Convex

## Objetivo

La Fase 8 podía avisar de «Playlists enviadas» tras emitir el último fragmento WebRTC, aunque el receptor no hubiera terminado su transacción IndexedDB. La Fase 9 añade una confirmación de **persistencia en el receptor**, no solo de envío por `RTCDataChannel`.

- El receptor responde `PLAYLIST_V2_ACK` **después** de que `restorePortableP2PPlaylist` termine de guardar la playlist y las LRC en IndexedDB.
- `ok: true, status: "saved"` confirma una playlist nueva; `ok: true, status: "duplicate"` confirma que se reconoció una duplicada sin sobreescribirla.
- `ok: false` devuelve un error de importación (por ejemplo, problemas de IndexedDB).
- El emisor espera el ACK hasta 90 s y notifica un error si no llega. Al cerrar la conexión se rechazan inmediatamente las confirmaciones pendientes. **En caso de timeout, no se deduce que la lista no se haya guardado:** comprobar el receptor antes de intentar reenviar.
- Safari puede decodificar datos binarios de manera asíncrona (`Blob.arrayBuffer`). Los mensajes entrantes se procesan ahora en orden, de modo que un `END` no se procese por delante de un `CHUNK` recibido antes.
- Nada del contenido (playlists, LRC) se escribe en Convex. El servicio de señalización P2P `nearbyShare` y la autenticación siguen usando Convex.

## Compatibilidad

**Instalar Fase 9 en ambos dispositivos para tener confirmaciones fiables.** Un receptor de Fase 8 puede recibir y guardar una transferencia V2 pero **no sabe responder con ACK**: el emisor de Fase 9 avisará por timeout aunque la importación se haya realizado. Antes de reenviar, revisar la playlist de destino. Se sigue aceptando el mensaje `PLAYLIST` v1, sin letras LRC ni ACK.

## Instalación incremental

1. Antes de instalar, **exporta ZIP v2 de Music y Classical (con letras LRC)** desde cada navegador con datos. IndexedDB es específico de cada navegador/origen.
2. Usa `develop` como rama de trabajo y compara cambios locales. La Fase 9 se instala sobre las Fases **5, 6, 7 y 8** en orden.
3. Descomprime el ZIP en la raíz de Shopp y conserva las rutas de `src/` y `tests/`. Reemplaza solamente `src/services/playlistP2PTransfer.js` y `src/screens/playlist/P2PPlaylistExchangeScreen.js`; añade 2 tests y esta guía.
4. Publica primero en el entorno de pruebas de Netlify; actualiza ambas sesiones iPad/Mac y verifica que no haya una pestaña con código antiguo.

## Pruebas de código realizadas

```sh
node --test tests/playlist-p2p-confirmation.test.mjs tests/playlist-local-convex-contract.test.mjs
node --test tests/*.test.mjs
```

- **9/9 nuevas** correctas: ACK `saved`, `duplicate`, NACK, timeout, desconexión, correlación de transferencias y tres controles estáticos de accesos locales.
- **39/41 generales** correctas. Persisten 2 fallos preexistentes y ajenos a Music/Classical: `dialog-behavior.test.mjs` (cargador de módulos) y `scanned-product-flow.test.mjs` (campo categoría esperado).
- Ambos archivos modificados pasan el analizador sintáctico JSX/JavaScript. Estas pruebas **no equivalen** a una ejecución de Expo, Safari, Chrome o a una medición real de Convex.

## Comprobación manual sobre Mac e iPad

1. Inicia `npx expo start --web` o abre la URL de pruebas de Netlify. Usa la **misma versión Fase 9** en ambos dispositivos.
2. Mac: crea una Music Playlist con una canción YouTube y LRC; crea una Classical Music con el mismo vídeo y una letra distinta. Exporta backups ZIP v2 y conserva una copia.
3. iPad Safari, vertical: importa una de las listas y confirma sus letras sincronizadas. Cierra y vuelve a abrir la web: los datos deben persistir. Repite con Chrome iPad; **sus IndexedDB son independientes**.
4. En Mac, marca ambas listas como compartidas. Abre P2P, acepta el handshake en iPad y envía. La alerta de éxito del emisor debe aparecer **después** de que el receptor haya guardado cada playlist.
5. Repite el envío y confirma que se detecta el duplicado. Interrumpe la conexión: el emisor debe mostrar error, no éxito. Si el receptor había guardado antes del corte, no debe duplicar al reintentar.
6. Comprueba reproducción de vídeo (depende de YouTube), letras LRC locales, modificación individual y borrado. El uso de Music o Classical fuera de P2P debe funcionar sin conectarse a Convex para operaciones `api.playlists.*`.

## Auditoría real de Convex (necesaria para afirmar «cero operaciones»)

1. Abre Convex Dashboard > Logs/Usage del deployment exacto de pruebas. Registra hora y contadores **antes** de una sesión de Music/Classical. Conviene usar un deployment de pruebas sin otras sesiones activas para distinguir el tráfico.
2. Sin abrir P2P y sin pulsar «Migrar desde Convex», crea, edita, borra, reproduce y exporta listas Music/Classical. Recarga Safari/Chrome y repite. Busca eventos de `playlists.listMine`, `playlists.create`, `playlists.update`, `playlists.remove`, `playlists.generateUploadUrl`, `playlists.setShareable` y cualquier llamada de subida/descarga de LRC desde Storage de Convex. El resultado esperado de **estas operaciones** es **0**.
3. Ahora pulsa P2P. Las funciones `nearbyShare.*` y `users.current` pueden registrar actividad legítima; el contenido intercambiado y las LRC deben seguir sin operaciones `api.playlists.*`.
4. Una migración pulsada explícitamente **sí** puede ejecutar `playlists.listMine` y descargar letras remotas; por eso debe analizarse en una ventana distinta.
5. Si el panel registra llamadas a `api.playlists.*` durante el uso ordinario, anota nombre de función, hora, dispositivo, acción realizada, URL/despliegue y captura de Logs: eso permite reproducir y corregir el último origen.

## Límites pendientes

- Prueba funcional real iPad Safari/Chrome, WebRTC entre Mac/iPad y lectura de Dashboard Convex: pendientes.
- Se exige Fase 9 en ambos extremos para que el emisor reciba confirmación; un receptor anterior puede importar correctamente sin enviar ACK.
- La PWA utiliza IndexedDB; la app instalada nativa React Native continúa con otro almacenamiento.
- El vídeo YouTube necesita Internet, aunque la LRC esté almacenada localmente.
