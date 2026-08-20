# Shopp PWA

Shopp es una aplicación Expo/React Native para iOS, Android y Web/PWA. Combina listas de compra, catálogo de productos por código de barras, tiendas, chat y parking colaborativo.

## Funciones actuales

- Listas de compra con cantidades, precios, promociones, totales e histórico.
- Escaneo EAN, edición de productos, historial y caché.
- Clasificación de productos de supermercado, libros y música, con campos e imágenes adecuados a cada tipo.
- Tiendas favoritas, ubicación, distancia y mapas.
- Chat por salas con moderación y caducidad de mensajes.
- Parking colaborativo mediante destinos, estados y plazas compartidas.
- Perfil, autenticación con Convex Auth y administración protegida por roles.
- Exportación de datos y preferencias locales.

> “Música” es un tipo de producto catalogable. La antigua sección de álbumes y reproductor musical ya no forma parte de la aplicación.

## Tecnología

- Cliente: Expo + React Native, con una base de código común.
- Backend: Convex para autenticación, datos compartidos y funciones del servidor.
- Web/PWA: exportación web y despliegue habitual en Netlify.
- Datos locales: capa `src/storage` para preferencias, caché y datos que no necesitan sincronización.

Heroku, PostgreSQL externo, Socket.IO y Google Drive pertenecen a etapas anteriores y no forman parte de la arquitectura actual.

## Inicio rápido

```bash
npm install
npx convex dev
npx expo start
```

El cliente necesita esta variable:

```bash
EXPO_PUBLIC_CONVEX_URL=https://tu-deployment.convex.cloud
```

No guardes secretos en variables `EXPO_PUBLIC_*`. La configuración privada de autenticación y correo debe residir en Convex.

Comandos habituales:

```bash
npx expo start -c       # limpiar caché
npx expo start --web   # ejecutar Web
npm run build          # generar la versión Web/PWA
```

## Documentación

- [TECHNICAL.md](TECHNICAL.md): arquitectura, carpetas, datos y despliegue.
- [MAINTENANCE.md](MAINTENANCE.md): administración, diálogos, limpieza y documentación histórica.

