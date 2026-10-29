# Shopp Fase 12C — desplazamiento del reverso solo por controles de pantalla

## Qué cambia

- **Eliminado el valor predeterminado Y = +2 mm** de la Fase 12B.
- Ahora los controles horizontal y vertical comienzan en **X = 0 mm, Y = 0 mm**.
- El botón **Restablecer ajustes** vuelve a **0/0**, no a 0/+2.
- Los botones `+` y `−` controlan exclusivamente el desplazamiento del reverso; intervalos de 0,5 mm, de -3 a +3 mm.
- No se modifica el tamaño de las tarjetas (90 × 56 mm), los márgenes geométricos base de la cuadrícula ni las líneas de corte (0,10 mm).
- El anverso no se desplaza. No se introducen compensaciones ocultas.

## Instalación

1. En la rama `develop`, sobre **Shopp con la Fase 12B**, guarda una copia del archivo actual.
2. Sustituye `src/screens/playlist/PrintMusicCardScreen.js` por el contenido de este ZIP.
3. Reinicia o recarga la aplicación. Abre «Imprimir tarjeta» > Hoja A4.
4. Confirma que Horizontal es **0,0 mm**, Vertical **0,0 mm** y «Restablecer» dice «X 0 mm · Y 0 mm».
5. En Chrome selecciona A4, escala **100 %**, sin encabezado/pie y sin márgenes añadidos por el navegador. La plantilla ya posiciona las tarjetas a 15 mm del borde lateral y a 8,5 mm del superior.
6. Haz una prueba dúplex con la Canon TS8750; si existe desplazamiento físico, utiliza los botones X e Y para corregirlo en incrementos de 0,5 mm.

En una hoja con menos de 10 tarjetas, las posiciones restantes quedan en blanco deliberadamente para mantener el mismo registro en ambas caras.

**Nota:** antes de entregar tarjetas con QR verifica que no contengan `localhost:8081` y que apunten a una URL pública HTTPS o a YouTube.

## Verificación

`node --test tests/print-music-card-calibration.test.mjs`

Las pruebas automatizadas comprueban la ausencia del desplazamiento predeterminado de 2 mm, la aplicación exclusiva de X/Y, el tamaño de la cuadrícula y la generación de dos páginas HTML para 10 tarjetas a doble cara. La alineación final depende de la Canon y se confirma mediante una impresión física.
