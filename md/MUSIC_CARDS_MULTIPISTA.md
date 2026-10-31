# Music Cards multipista

## Publicar una selección con QR permanente

1. Abre **Imprimir tarjeta** desde una playlist y elige **Canciones individuales**.
2. En **Preparar tarjetas**, agrupa los temas que deben reproducirse como una sola selección.
3. Activa **Incluir LRC autorizados disponibles** solo para letras que puedas publicar.
4. Pulsa **Publicar selección y preparar QR**. Shopp guarda una ficha pública e inmutable en Convex.
5. Comprueba el enlace en la vista previa y luego imprime o guarda las tarjetas como PDF.

El QR abre `music-card.html?card=<id>` en la web pública. El reproductor permite iniciar la selección con una pulsación, avanza al tema siguiente y muestra la línea LRC sincronizada cuando esa pista incluye una letra.

Las fichas se publican para cualquier persona que tenga el QR. Los cambios de título, orden, vídeos o letras crean una nueva versión pública con otro QR; las tarjetas impresas anteriores siguen apuntando a la ficha original.

## Requisitos de despliegue

- Desplegar la nueva función `publicMusicCards:publishCollection` en el despliegue de Convex usado por la aplicación.
- Mantener en Netlify `EXPO_PUBLIC_CONVEX_URL` o `CONVEX_URL` configurado para esa misma instancia de Convex.
- El endpoint público `/.netlify/functions/publicMusicCard` ya sirve las fichas individuales y multipista; no es necesario copiar JSON ni letras a `public/music-cards/` para este flujo.

La publicación requiere una sesión autenticada. La lectura pública de una ficha se hace mediante su identificador aleatorio y no requiere iniciar sesión.
