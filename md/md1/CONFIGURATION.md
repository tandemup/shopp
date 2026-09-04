# Configuración y despliegue

## Variables de entorno

La variable esencial del cliente es:

```bash
EXPO_PUBLIC_CONVEX_URL=https://tu-deployment.convex.cloud
```

No se deben incluir secretos en el código ni en variables `EXPO_PUBLIC_*`. La configuración privada de autenticación, correo y tareas de Convex se establece en el deployment de Convex.

## Desarrollo

```bash
npm install
npx expo start
```

Comandos útiles:

```bash
npx expo start -c
npx expo start --web
npx expo run:ios
npx expo run:android
```

## PWA

El proyecto contiene `public/manifest.webmanifest`, `public/sw.js` y `public/_redirects`. La compilación web se realiza con:

```bash
npm run build
```

Netlify debe publicar el resultado de la exportación web y recibir la variable `EXPO_PUBLIC_CONVEX_URL` en su configuración.

## Convex

Durante el desarrollo del backend se utiliza:

```bash
npx convex dev
```

Las funciones de `convex/` y el esquema deben desplegarse en el mismo proyecto Convex que usa la aplicación. Heroku, PostgreSQL externo y un servidor Socket.IO no forman parte del despliegue actual.
