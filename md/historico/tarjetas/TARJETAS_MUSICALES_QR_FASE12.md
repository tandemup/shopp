# Shopp — Fase 12. Tarjetas musicales QR (90 × 56 mm)

## Contenido del ZIP (solo archivos nuevos y modificados)

- `src/screens/playlist/PrintMusicCardScreen.js` — ampliar pantalla ya existente (QR: landing, YouTube o reproductor público Shopp; 10 temas diferentes por A4; archivo de publicación de playlists).
- `src/services/musicCardLinks.js` — URLs validadas y manifiestos públicos mínimos.
- `src/screens/playlist/PublicMusicCardScreen.js` — reproductor público Shopp sin sesión, que no utiliza IndexedDB ni Convex.
- `public/music-card.html` — landing pública responsive con dos botones.
- `public/music-cards/LEEME.txt` — ubicación de manifiestos para playlists compartidas.
- `App.js` — intercepta `?shoppCard=1` antes de pedir sesión/Convex.
- `tests/music-cards-qr.test.mjs` — pruebas de URL, privacidad y maquetación.

## Instalar

1. Hacer copia de la rama `develop` con Fase 11 y respaldar las playlists.
2. Copiar los archivos del ZIP **conservando sus rutas**. Revisar el diff de `App.js` y `PrintMusicCardScreen.js`, en particular si has retocado la interfaz del iPad.
3. Ejecutar `node --test tests/music-cards-qr.test.mjs`.
4. Ejecutar `npx expo export -p web` y publicar con Netlify.
5. Abrir Music Playlist o Classical Music → menú de una playlist → **Crear tarjeta**.
6. Escribir en «URL de Shopp publicada» la URL HTTPS real del sitio Netlify, **no localhost**.

## Tarjetas de canciones individuales (operativas sin fichero JSON)

- Elegir **Canciones distintas** para generar una tarjeta por pista válida de la playlist (máximo 99 por operación, 10 por A4).
- Elegir `QR → Página Shopp` (por defecto) o `QR → YouTube directamente`.
- Pulsar «Imprimir / Guardar como PDF», seleccionar A4, escala 100 %, sin márgenes añadidos ni «ajustar a página»; comprobar impresión de prueba dúplex. La carátula en cada tarjeta procede de la pista, cuando exista, o de la miniatura de YouTube. Para una sola tarjeta personalizada, usar «Primera canción (copias)».

## Tarjetas para playlist completa (requiere publicación estática)

Debido a que las playlists están en IndexedDB del emisor, otro teléfono NO puede leerlas por un enlace de forma directa. La publicación siguiente es explícita y **no utiliza Convex**:

1. En «Contenido» seleccionar «Playlist completa». Elegir página Shopp o reproductor Shopp (YouTube directo abre solo el primer vídeo).
2. Pulsar **Descargar ficha JSON pública**. Por ejemplo, descargará `shopp-xxxx.json`.
3. Copiar el archivo a `public/music-cards/shopp-xxxx.json` del proyecto y publicarlo en Netlify. Asegúrate de que se sirve desde `https://TU-DOMINIO/music-cards/shopp-xxxx.json` con MIME JSON. No basta con dejarlo en el Mac.
4. Sin salir de «Crear tarjeta», pulsar **Comprobar publicación**. La pantalla comparará la ficha remota con los datos que quiere publicar y solo después habilitará la impresión del QR para esa playlist.
5. Reproducir en cualquier dispositivo que tenga conexión a Internet: primero se abrirá la landing y después, pulsando Abrir en Shopp, el reproductor público de la aplicación. Reproducir el vídeo requiere una pulsación explícita en iOS/Safari.

**Privacidad**: la ficha pública contiene título, autor, colección, y títulos e IDs YouTube de las pistas. No publica letra LRC, email, identificadores de cuenta, ni claves IndexedDB. Una playlist pública publicada en Netlify será accesible a cualquiera que conozca el enlace. No compartir playlists privadas mediante este mecanismo.

## Consideraciones

- Para los QR se conserva el servicio de imágenes `quickchart.io`, que ya utilizaba la pantalla original. Requiere conexión a Internet para generar/imprimir esos gráficos, y esa web recibe la URL pública del QR. No hay nuevas dependencias npm.
- Netlify debe hospedar `public/music-card.html` y los manifiestos. Para compartir tarjetas **sin** desplegar archivos estáticos, escoger QR directo a YouTube.
- El reproductor Shopp público carga vídeos mediante YouTube: NO garantiza autoplay (Safari exige interacción) y no replica en IndexedDB las playlists recibidas. No reproduce ni publica LRC, que se mantienen locales.
- Las portadas se muestran con `object-fit: contain`, no se deforman.
- Para impresión dúplex hay opciones de volteo largo y corto. **Hacer una impresión de prueba** para confirmar orientación de la impresora antes de imprimir 10 tarjetas.
- No se ha certificado aún comportamiento de impresión en Safari/Chrome físicos ni medido uso real Convex.
