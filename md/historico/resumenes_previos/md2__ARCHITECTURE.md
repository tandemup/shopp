# Arquitectura actual

## Flujo principal

```text
App.js
  ├─ ConvexReactClient
  ├─ ConvexAuthProvider
  └─ AppNavigator
       ├─ AuthStack si no hay sesión
       └─ MainTabs si el usuario está autenticado
```

Las pestañas actuales son Shopping, Tiendas, Chat, Scanner y Menu. Cada pestaña contiene su propio stack de navegación.

## Backend

Convex proporciona autenticación, consultas reactivas, mutaciones, autorización y almacenamiento de datos. Las áreas principales son listas/artículos, productos, escaneos, tiendas, favoritos, perfiles, chat, parking, revisiones y adjuntos.

El cliente no accede directamente a la base de datos: usa las funciones de `convex/*.js` mediante `useQuery`, `useMutation` o el cliente Convex.

## Persistencia local

La aplicación mantiene una capa de almacenamiento en `src/storage`. Se usa para preferencias, ajustes, configuraciones del escáner, favoritos o datos locales que no necesitan compartirse. Los datos sincronizados o compartidos deben permanecer en Convex.

El almacenamiento local no sustituye a Convex: borrar una copia local no elimina automáticamente los datos remotos.

## Compatibilidad multiplataforma

Los archivos con sufijo `.web.js` y `.native.js` permiten adaptar cámara, mapas, almacenamiento y enlaces a cada plataforma. La PWA utiliza APIs del navegador; iOS y Android utilizan las APIs nativas disponibles en Expo.
