# Guía técnica

## Arquitectura

`App.js` inicializa Convex, la autenticación y la navegación. Sin sesión se muestra el flujo de autenticación; con sesión se muestran las pestañas principales de compras, tiendas, chat, escáner y menú.

El cliente accede al backend mediante consultas y mutaciones de `convex/*.js`. Convex mantiene los datos sincronizados y compartidos. La capa `src/storage` conserva preferencias, configuración, caché e información local; eliminar una copia local no elimina automáticamente su equivalente remoto.

Las diferencias de plataforma se aíslan, cuando es necesario, mediante archivos `.web.js` y `.native.js` para cámara, mapas, almacenamiento y enlaces.

## Mapa del proyecto

| Ruta | Responsabilidad |
|---|---|
| `App.js` | Inicialización, proveedores y entrada de navegación. |
| `src/navigation/` | Pestañas, stacks y rutas. |
| `src/screens/` | Pantallas de autenticación, compras, escáner, tiendas, chat, parking, perfil y administración. |
| `src/components/` | Componentes reutilizables y controles de interfaz. |
| `src/context/` | Estado compartido del cliente. |
| `src/storage/` | Persistencia local multiplataforma. |
| `src/services/` | Búsqueda externa, exportación, historial y otras integraciones. |
| `src/utils/` | Precios, categorías, distancias, validación y formato. |
| `convex/` | Esquema, autenticación, autorización, consultas, mutaciones y tareas programadas. |
| `public/` | Manifiesto, service worker y redirecciones de la PWA. |
| `docs/` | Página informativa, privacidad y soporte. |

## Datos y seguridad

- Convex Auth controla la identidad y la sesión.
- La autorización sensible debe verificarse en el backend, no solo ocultando botones.
- Las funciones administrativas usan un rol y una comprobación equivalente a `requireAdmin(ctx)`.
- Los secretos se configuran en el deployment de Convex; nunca en código o variables públicas del cliente.
- Las imágenes y otros adjuntos compartidos deben usar el almacenamiento remoto previsto por el proyecto; las copias locales son caché.

## Despliegue

1. Instalar dependencias con `npm install`.
2. Configurar `EXPO_PUBLIC_CONVEX_URL`.
3. Ejecutar o desplegar esquema y funciones con Convex.
4. Probar con `npx expo start` en las plataformas necesarias.
5. Generar la exportación web con `npm run build` y publicar su resultado en Netlify.

La PWA depende de `public/manifest.webmanifest`, `public/sw.js` y `public/_redirects`.

