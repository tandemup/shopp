BIBLIOTECA V8 — SALIR CORRECTAMENTE DEL FILTRO DE HASHTAG

Problema:
Después de seleccionar un hashtag exacto (por ejemplo #brexit),
selectedHashtagFilter quedaba activo aunque el usuario intentase volver
a navegar por Biblioteca. El filtro exacto seguía teniendo prioridad
sobre la consulta normal y dificultaba volver a mostrar artículos.

Corrección:
- Pulsar Todos elimina el filtro exacto.
- Pulsar Favoritos elimina el filtro exacto.
- Pulsar Sin clasificar elimina el filtro exacto.
- Pulsar Noticias, Libros, Informática u otra carpeta elimina el filtro exacto.
- Cambiar entre Periódicos / Noticias guardadas elimina el filtro exacto.
- Una búsqueda manual elimina el filtro exacto.
- Recuperar una URL ya existente elimina el filtro exacto antes de mostrarla.
- Crear y entrar en una categoría nueva elimina el filtro exacto.

Indicador visible:
Cuando hay un hashtag seleccionado aparece una banda:
  Filtro exacto: #brexit   N   [Mostrar noticias]

"Mostrar noticias":
- elimina el hashtag activo;
- limpia la búsqueda #hashtag;
- entra directamente en Noticias > Noticias guardadas.

No hay cambios en Convex ni en schema.js.

Archivo modificado:
- src/screens/library/LibraryScreen.js

Instalación:
1. Sustituir LibraryScreen.js.
2. Ejecutar:
   npx expo start -c

No es necesario volver a desplegar Convex para esta corrección de interfaz.
