# Play/Pause por pista en reproductor público Shopp

Base: `shopp-main(20261018-190107).zip` con el archivo `PublicMusicCardScreen.js` actualizado a la versión de 4 vistas + LRC del paquete `Shopp_QR_LRC_preparacion_caratulas.zip`.

## Instalación

Copiar `src/screens/playlist/PublicMusicCardScreen.js` sobre el archivo del proyecto, conservando la ruta.

## Comportamiento

- Pulsar una pista distinta: selecciona e intenta iniciar el vídeo en el reproductor público.
- Pulsar la pista actual mientras está reproduciéndose: pausa el iframe oficial de YouTube.
- Pulsar la pista actual mientras está pausada: reanuda.
- El icono de la pista actual es Pause durante la reproducción y Play cuando no lo está.
- Los estados provienen del evento YouTube `onStateChange`; el icono no simula éxito sin confirmación.
- Se mantiene la reproducción continua cuando finaliza un vídeo.
- Se aplica a Completo, App · 1 col y App · 2 col. Simplificado no tiene lista.

## Comprobación manual

1. En un enlace público, selecciona «App · 2 col».
2. Pulsa Play en una pista y verifica que cambia a Pause cuando comienza el vídeo.
3. Pulsa Pause, comprueba que el vídeo se detiene; pulsa Play para continuar.
4. Pulsa Play en otra pista. Comprueba que cambia el vídeo y arranca si el navegador lo permite.
5. Deja terminar un vídeo y comprueba el avance automático.
6. Repite en Completo y App · 1 col, y en Safari/Chrome móvil.

La reproducción automática entre vídeos depende de YouTube y de las políticas del navegador.
No se modifican datos, QR, LRC, impresión, Convex ni `package.json`.
