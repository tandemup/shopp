# Shopp — corrección de líneas de corte y calibración dúplex (Fase 12B)

## Instalación

Sustituir exclusivamente `src/screens/playlist/PrintMusicCardScreen.js` dentro del proyecto que ya tiene instalada la Fase 12/12A. No afecta a IndexedDB, LRC ni Convex.

## Cambios

- Una retícula de líneas **únicas de 0,10 mm** de grosor. Se dibuja *encima* de las 10 tarjetas sin ocupar sitio en su geometría (90 × 56 mm cada una).
- Desactivar «Líneas de corte para tijera» ahora elimina realmente todas las líneas: antes quedaba un borde gris de 0,22 mm.
- Control horizontal y vertical del reverso en pasos de 0,5 mm, con rango de −3 a +3 mm y valores iniciales **X = 0 mm**, **Y = +2 mm**. Afecta solo al reverso de una hoja A4.
- La plantilla trabaja con páginas A4 de margen CSS 0 y posiciona las tarjetas a 15 mm desde el lateral y 8,5 mm desde arriba. El reverso se desplaza dentro de ese espacio, sin mover ni aumentar la página.
- El cuadro de impresión de la aplicación ahora tiene scroll para que los controles sean accesibles desde móvil/iPad.

## Procedimiento para calibrar la Canon

1. Abrir «Imprimir tarjeta», elegir **Hoja A4**, activar doble cara y seleccionar el volteo correcto de la impresora.
2. Mantener X 0 / Y +2 en la primera prueba. En Chrome, elegir papel A4, **escala 100 %**, márgenes **Ninguno** si lo solicita el diálogo, y activar **gráficos de fondo** para conservar los colores.
3. Comprobar que la vista previa contiene **dos páginas para diez tarjetas**; una de anversos y otra de reversos.
4. Imprimir una sola hoja de prueba a doble cara y medir el desajuste con una regla. Ajustar X o Y en 0,5 mm, reimprimir, comprobar de nuevo. Un error progresivo entre la primera y la quinta fila no se corrige con un desplazamiento constante: hay que revisar escala, márgenes y arrastre del papel.

## Validación realizada

- Se ha comprobado el código generador de hojas con 10 tarjetas, con y sin líneas, y con los ajustes predeterminados y máximos.
- Se han generado y verificado **PDF de dos páginas** (A4) en un renderizador HTML/PDF de pruebas; también el formato de tarjeta individual mantiene dos páginas de 90 × 56 mm.
- **Pendiente**: verificación del número de páginas en Chrome del Mac y comprobación de la alineación real con la Canon TS8700.
