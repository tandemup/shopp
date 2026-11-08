# Shopp — Fase 1B: tiendas y listas

## Objetivo

Desacoplar los contextos y pantallas centrales de tiendas y listas sin cambiar proveedor, datos ni persistencia.

## Cambios

- `useStoresData` delega en el adaptador Convex; el catálogo solo se consulta para administradores.
- `StoresContext` conserva `stores`, `ready`, favoritos y métodos de acceso; incorpora `importStores` para evitar que la pantalla cree otra suscripción al catálogo.
- Solicitudes de creación de tiendas y moderación admin encapsuladas mediante `useStoreRequests`.
- `ListsContext` usa un repositorio local sin red, con las mismas claves de almacenamiento anteriores.
- `ShoppingListsScreen` utiliza `useCurrentUser` de la fase 1A.

## Deliberadamente fuera del alcance

- Ofertas, consultas puntuales de tiendas en otros módulos y el resto de dependencias Convex.
- Implementación Node.js/Express (no disponible todavía); debe mantenerse `EXPO_PUBLIC_BACKEND_PROVIDER=convex`.
- Cambios en sincronización de Biblioteca, chat, playlists o esquema Convex.

## Instalación

Aplicar **primero la fase 1A** (si aún no está integrada) y después copiar los archivos de este ZIP sobre el proyecto, preservando las rutas. Ejecutar:

```bash
node --test tests/backend-phase1a.test.mjs tests/backend-phase1b.test.mjs
git diff --check
npx expo start --web --clear
```

## Comprobación manual

1. Entrar con usuario administrador: catálogo de tiendas, favoritos, importación/exportación JSON.
2. Entrar como usuario normal: solicitar nueva tienda; no descargar el catálogo completo en contexto.
3. Como administrador: aprobar/rechazar solicitudes pendientes.
4. Abrir, editar, archivar e importar listas; reiniciar pestaña y comprobar persistencia.
5. Probar modo invitado y comprobar que mantiene su clave local propia.

Los tests suministrados son estructurales y **no sustituyen** las pruebas funcionales en Expo o dispositivo.
