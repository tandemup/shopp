# Shopp — fase 4K: pruebas controladas de QR e impresión

Este paquete es acumulativo respecto a 4J y contiene los cinco archivos JavaScript de la fase anterior. Reemplaza los archivos respetando las rutas. No requiere nuevas dependencias.

## Cambios

- Una tarjeta habilitada sin URL de QR ya no desaparece silenciosamente de la selección; la validación previa la detecta y bloquea la impresión.
- La verificación de manifiestos se invalida al cambiar parámetros de impresión, la selección, títulos o carátulas; debes verificar de nuevo.
- Botón **Descargar informe JSON de prueba** dentro de «Preparar impresión», en Web. Incluye posiciones, títulos, URL de cada QR, movimientos, avisos y parámetros de impresión. Las imágenes incrustadas en base64 no se copian al informe.
- Advertencia de múltiples hojas A4 cuando hay más de 10 tarjetas.

## Procedimiento de pruebas

1. Abrir Música Clásica, agrupar los cuatro movimientos de la Sinfonía n.º 7 y seleccionar una sola tarjeta por obra.
2. Exportar/publicar los manifiestos y pulsar **Verificar toda la hoja**.
3. Descargar el informe. Revisar `cards[].qrUrl` y `cards[].trackIndices` y abrir las URL desde un iPhone sin instalar la PWA.
4. Comprobar la reproducción consecutiva de todos los movimientos, que depende de las restricciones de YouTube/Safari.
5. Revisar las diez posiciones en la vista previa y realizar una prueba física A4 dúplex a escala 100%, sin «Ajustar a página».
6. Medir los márgenes tras recortar antes de utilizar cartulina definitiva.

La descarga del informe **no** garantiza disponibilidad real del vídeo, ni hace una impresión física. La verificación del servidor sigue correspondiendo al botón «Verificar toda la hoja».
