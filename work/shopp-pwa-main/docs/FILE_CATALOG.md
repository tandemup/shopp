# Catálogo de archivos

La estructura completa se puede consultar con `find . -type f`. Las carpetas tienen estas responsabilidades:

| Carpeta | Contenido |
|---|---|
| `convex/` | Esquema, autenticación, queries, mutations, actions, cron y migraciones |
| `src/navigation/` | Navegadores, stacks, pestañas y nombres de rutas |
| `src/screens/` | Pantallas de autenticación, listas, tiendas, scanner, chat, parking, perfil, historial y administración |
| `src/components/` | Componentes reutilizables de interfaz, mapas, scanner, búsqueda, tiendas y diálogos |
| `src/context/` | Estado compartido de listas, tiendas, ubicación y aprendizaje de productos |
| `src/hooks/` | Hooks para consultas, caché, historial y distancia |
| `src/services/` | Búsqueda de productos, historial, exportación y seguridad de URLs |
| `src/storage/` | Fachada de almacenamiento, IndexedDB web, adaptador nativo y preferencias específicas |
| `src/utils/` | Precios, distancias, mapas, validación, categorías, búsqueda, formato y utilidades comunes |
| `src/constants/` | Catálogos de categorías, tiendas, monedas, unidades, cámaras y buscadores |
| `src/data/` | Datos seed y datos de fábrica |
| `scripts/` | Importación/exportación/reset de datos y carga de tiendas |
| `public/` | Manifest PWA, service worker y redirecciones |
| `docs/` | Sitio informativo y documentación técnica |
| `md/` | Documentación histórica pendiente de depuración |
| `assets/` | Iconos, imágenes, categorías y audio |

## Convención de estado

- **Activo**: importado desde navegación o usado por una feature.
- **Compartido**: adaptador o utilidad usada por varias áreas.
- **Generado**: archivos de `convex/_generated`; no editar manualmente.
- **Revisar**: pruebas, debug, snippets o documentación histórica.

Para documentar un archivo concreto, localizar sus imports con `rg "NombreDelArchivo" src convex App.js` y comprobar también las rutas dinámicas y las referencias de Convex.
