# Shopp PWA — documentación actual

Shopp es una aplicación Expo/React Native para iOS, Android y Web/PWA. La versión actual usa Convex como backend central y Netlify como destino habitual de la versión web.

## Funciones activas

- Listas de compra, artículos, cantidades, precios, promociones e histórico.
- Búsqueda y edición de productos mediante código de barras.
- Historial de escaneos y caché de productos.
- Catálogo de tiendas, favoritas, distancia, ubicación y mapas.
- Chat por salas, moderación de enlaces y eliminación automática de mensajes caducados.
- Parking colaborativo con destinos, estados, ubicación y plazas compartidas.
- Perfil de usuario con alias y teléfono opcional.
- Autenticación real con Convex Auth, registro, inicio de sesión, verificación OTP y recuperación de contraseña.
- Paneles administrativos para usuarios, revisiones de productos y diagnóstico.
- Exportación de datos y almacenamiento local para ajustes, historial y preferencias.

## Funciones que no deben documentarse como activas

La aplicación actual no contiene una funcionalidad de álbumes/reproductor musical ni una integración operativa de Google Drive. Los documentos históricos sobre Heroku, PostgreSQL, Socket.IO, música o Google Drive deben conservarse únicamente como archivo histórico, no como instrucciones de instalación.

## Inicio rápido

```bash
npm install
npx expo start
```

Para limpiar la caché:

```bash
npx expo start -c
```

La configuración mínima requiere `EXPO_PUBLIC_CONVEX_URL`; el resto de variables depende del despliegue y de los servicios de autenticación/correo configurados en Convex.

Consulta [ARCHITECTURE.md](ARCHITECTURE.md), [CONFIGURATION.md](CONFIGURATION.md), [FEATURES.md](FEATURES.md), [FILE_CATALOG.md](FILE_CATALOG.md) y [CLEANUP_AUDIT.md](CLEANUP_AUDIT.md).
