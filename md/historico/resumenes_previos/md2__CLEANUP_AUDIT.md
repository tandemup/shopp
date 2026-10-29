# Auditoría de documentación y limpieza

## Corregido en esta documentación

- Se elimina la descripción de Heroku, PostgreSQL y Socket.IO como arquitectura vigente.
- Se sustituye la autenticación simulada por Convex Auth.
- Se separan Convex y almacenamiento local: uno sincroniza datos y el otro conserva preferencias/caché local.
- Se aclara que las pantallas de diagnóstico y semillas no son funcionalidades principales.
- Se omiten música, álbumes y Google Drive como funciones activas de esta versión.

## Restos que conviene revisar en el código

- `CarrefourTestScreen`, `ParkingGpsDebugScreen` y `ProductLearningDebugScreen` parecen herramientas de prueba o administración.
- Hay utilidades de distancia, tiendas, alertas y almacenamiento con responsabilidades próximas; conviene unificarlas gradualmente, verificando antes sus importaciones.
- `src/services/services-comentarios.md`, `md/heroku.md` y `md/instrucciones.md` son documentación histórica incompatible con el backend actual.
- `expo-av` sigue siendo una dependencia válida si se mantiene el audio de Noticias; no debe interpretarse como reproductor de álbumes.

## Criterio de eliminación

No borrar automáticamente archivos heredados. Primero comprobar referencias con `rg`, retirar rutas de navegación y ejecutar pruebas Web/iOS/Android. Después actualizar `package.json`, lockfile y documentación.
