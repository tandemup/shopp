# Shopp — 10 reversos personalizables, QR común

## Instalación
Copiar `src/screens/playlist/PrintMusicCardScreen.js` sobre el mismo archivo dentro del repositorio Shopp, después de guardar copia del original. El archivo está construido sobre el parche anterior de publicación.

## Nuevo uso
1. Abrir una playlist > Crear tarjeta > Contenido «Playlist completa» y destino «Reproductor Shopp».
2. En «Reversos de las 10 tarjetas», marcar «Personalizar los 10 reversos».
3. Seleccionar cada número, editar título/subtítulo, elegir fuente de carátula y activar/desactivar su inclusión.
4. La vista previa mostrará el reverso seleccionado, y la hoja A4 imprimirá hasta diez reversos distintos (anverso común, QR de playlist común).
5. Publicar y verificar el JSON de la playlist antes de imprimir; descargar el ZIP no equivale a publicar.

## Compatibilidad
- Conserva los modos «Canciones distintas» y «Primera canción» y el editor existente de obras clásicas por movimientos.
- Conserva los parámetros dúplex, tamaño de tarjeta, márgenes, líneas de corte, y desplazamientos X/Y.
- Para QR individual de canciones/obras, usar el modo «Canciones distintas».

## Limitaciones
- Los cambios en cada reverso son de la sesión; para guardarlos como plantilla reutilizable hay que usar el gestor de plantillas existente.
- Para listas con menos de diez pistas, se completa la selección con reversos basados en la playlist.
- No se ha realizado una impresión física ni prueba funcional automatizada; comprobar en la aplicación y hacer una hoja de prueba antes de distribuir tarjetas.
