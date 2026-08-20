# Mantenimiento

## Administradores

Para activar el primer administrador, despliega las funciones, abre la tabla `users` en Convex, localiza el usuario y asigna `role: "admin"`. Después, cierra y vuelve a iniciar sesión si el menú no se actualiza. Los cambios posteriores pueden hacerse desde la pantalla de administración de usuarios.

La interfaz solo controla la visibilidad; la protección real debe permanecer en las consultas y mutaciones del backend.

## Diálogos

Los mensajes, confirmaciones y menús deben pasar por la API común `safeAlert`, `safeConfirm` y `safeMenu`, alojada en `components/ui/alert/`. `DialogHost` debe estar montado desde `App.js`.

Evita introducir llamadas directas a `Alert.alert`, `window.alert`, `window.confirm` o `window.prompt` fuera del módulo de respaldo. Así se mantiene un aspecto coherente en PWA, iOS y Android.

## Limpieza segura

Antes de retirar código heredado:

1. Buscar importaciones y rutas con `rg`.
2. Eliminar su acceso desde la navegación.
3. Probar Web, iOS y Android.
4. Actualizar `package.json`, el lockfile y esta documentación.

Las pantallas de diagnóstico o pruebas no deben presentarse como funciones normales. Conviene revisar especialmente las relacionadas con Carrefour, GPS de parking y aprendizaje de productos.

## Documentación histórica

Estos temas pueden conservarse fuera de la documentación principal, pero no deben usarse como instrucciones vigentes:

- servidor `shopp-server`, Heroku, PostgreSQL y Socket.IO;
- álbumes, reproductor musical y Google Drive;
- propuestas iniciales de parking ya sustituidas por la implementación actual;
- volcados completos de archivos usados para aplicar migraciones;
- tutoriales generales de Git, GitHub CLI y configuración de `origin`.

Si todavía resultan útiles, guárdalos en una carpeta `docs/archive/` con una advertencia visible de contenido histórico.

## Alcance de esta síntesis

Esta documentación se ha condensado a partir de los documentos entregados. Cuando cambie el código, el repositorio debe considerarse la fuente definitiva y estos tres archivos deben actualizarse junto con él.
