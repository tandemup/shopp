# Guía de variables de entorno de Shopp

Esta guía describe las variables del frontend de Shopp y del servidor `shopp-node-postgres`. No contiene valores secretos. Mantén los archivos de ambos componentes separados:

- **App Shopp:** `.env.local` en la raíz, junto a `package.json`.
- **Servidor:** `shopp-node-postgres/.env`, junto a `docker-compose.yml`.

Las variables cuyo nombre empieza por `EXPO_PUBLIC_` se incorporan al código del cliente y pueden ser visibles para quien use la app. Nunca pongas contraseñas, tokens, claves API ni secretos en ellas.

## 1. Variables de la app Shopp

### Convex

| Variable | Significado |
|---|---|
| `CONVEX_DEPLOYMENT` | Deployment seleccionado por la CLI de Convex para comandos como `npx convex dev`. No es una clave de autenticación del usuario. |
| `EXPO_PUBLIC_CONVEX_URL` | URL pública que el cliente de Shopp usa para conectarse al deployment Convex. Es necesaria cuando el proveedor activo es Convex. |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | URL HTTPS del sitio HTTP de Convex, habitualmente el dominio `convex.site`. En la versión revisada no encontré una lectura directa en el código de la app; consérvala solo si algún código, función o herramienta de despliegue la necesita. |

### Selección del backend

| Variable | Significado |
|---|---|
| `EXPO_PUBLIC_BACKEND_PROVIDER` | Selector principal. `convex` usa el flujo y las pantallas Convex; `node` usa el flujo Node independiente. En el código revisado es la variable que determina el backend. |
| `EXPO_PUBLIC_API_URL` | URL base de Express. Hace falta al seleccionar `node`. Para navegador en el mismo Mac puede ser `http://localhost:3001`; desde un teléfono hay que usar una dirección alcanzable del Mac, y en producción una URL HTTPS. No hace falta para usar Convex sin puente. |
| `EXPO_PUBLIC_BACKEND_MODE` | En los archivos revisados aparece con el valor `hybrid`, pero el código actual no la consulta. No controla por sí misma una combinación de proveedores. |
| `EXPO_PUBLIC_BACKEND_AUTH_PROVIDER` | Variable presente en los archivos, pero no consultada por el código actual. La autenticación la decide el proveedor principal. |
| `EXPO_PUBLIC_BACKEND_STORES_PROVIDER` | Variable presente en los archivos, pero no consultada por el código actual. No cambia por sí misma el backend de tiendas. |

### Arranque y presentación de la app

| Variable | Significado |
|---|---|
| `EXPO_PUBLIC_ACCESS_MODE` | Determina la pantalla inicial de acceso: por ejemplo, `landing`, `survey`, `login` o `development`. |
| `EXPO_PUBLIC_APP_MODE` | Define el modo de la app. `development` puede mostrar el acceso de desarrollo y detalles técnicos en algunos errores de autenticación. Evita usar ese modo como configuración pública de producción. |
| `EXPO_PUBLIC_CONTACT_EMAIL` | Dirección que se muestra en la pantalla de contacto. Es información pública para los usuarios; no es un secreto. |

## 2. Variables del servidor `shopp-node-postgres/.env`

Docker Compose lee este archivo y entrega al contenedor API las variables que necesita. No copies este archivo a la raíz de Expo ni lo subas al repositorio.

### PostgreSQL y puerto

| Variable | Significado |
|---|---|
| `POSTGRES_DB` | Nombre de la base de datos que crea/usa PostgreSQL; en esta configuración suele ser `shopp`. |
| `POSTGRES_USER` | Usuario PostgreSQL que usa Shopp, normalmente `shopp_app`. |
| `POSTGRES_PASSWORD` | Contraseña privada de ese usuario. Debe coincidir con la contraseña guardada en el volumen existente de PostgreSQL. Cambiar solo el archivo `.env` no cambia la contraseña dentro de una base ya inicializada. |
| `API_PORT` | Puerto del Mac que publica Docker. Por ejemplo, `3001` permite que el cliente local use `http://localhost:3001`; dentro del contenedor la API escucha en el puerto 3000. |

### Correo, códigos y sesiones

| Variable | Significado |
|---|---|
| `AUTH_RESEND_KEY` | Clave privada de Resend que usa la API para enviar correos de verificación y recuperación. |
| `AUTH_EMAIL_FROM` | Remitente de esos correos. Debe ser una dirección o dominio autorizado en Resend. |
| `AUTH_CHALLENGE_SECRET` | Secreto aleatorio del servidor para proteger los desafíos y códigos temporales de autenticación. Debe ser largo y privado. |
| `AUTH_JWT_SECRET` | Secreto aleatorio con el que la API firma los JWT de sesión. Debe mantenerse privado y ser distinto del secreto de desafíos. |
| `AUTH_JWT_ISSUER` | Identificador del emisor que se incorpora y valida en los JWT. Debe ser coherente en todas las instancias del mismo entorno. |
| `AUTH_JWT_AUDIENCE` | Identificador del cliente o audiencia autorizada para esos JWT. Debe ser coherente entre la API que los emite y la que los valida. |
| `SESSION_TTL_HOURS` | Duración de una sesión en horas. El servidor limita el valor máximo a 720 horas. |

### Red y proxy

| Variable | Significado |
|---|---|
| `CORS_ORIGINS` | Lista de orígenes web permitidos, separados por comas. En desarrollo suele incluir `http://localhost:8081` y `http://127.0.0.1:8081`. En producción añade el origen HTTPS exacto de la app. |
| `TRUST_PROXY` | Usa `false` para acceso local directo. Solo pon `true` cuando la API esté detrás de un proxy inverso controlado que configure correctamente las cabeceras de cliente. |

## 3. Puente Convex → Node

| Variable | Dónde corresponde | Significado |
|---|---|---|
| `SHOPP_NODE_API_URL` | Entorno del deployment Convex que ejecuta la función puente | URL HTTPS pública de Express para que Convex pueda llamar a Node. Una URL de túnel temporal puede cambiar al reiniciar el túnel. |
| `CONVEX_NODE_BRIDGE_SECRET` | Entorno de Convex y, si el puente está habilitado, configuración privada del servidor | Secreto compartido para autenticar las llamadas del puente. Nunca debe exponerse como `EXPO_PUBLIC_*`. |

**Estado en la versión revisada:** el `.env` del servidor contiene `CONVEX_NODE_BRIDGE_SECRET`, pero el `docker-compose.yml` y `server/src/config.js` de este proyecto no lo pasan/cargan como `convexBridgeSecret`. La ruta interna intenta leerlo, por lo que el puente no queda habilitado solo por añadir la variable al archivo. El inicio de sesión Node directo no requiere este puente. Antes de depender del puente hay que adaptar la configuración del servidor y Compose.

## 4. Perfiles habituales

### App usando Convex

En la raíz de la app, conserva al menos:

```dotenv
EXPO_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
EXPO_PUBLIC_BACKEND_PROVIDER=convex
```

`CONVEX_DEPLOYMENT` también debe estar configurada si vas a usar la CLI de Convex. `EXPO_PUBLIC_API_URL` no es necesaria para el flujo Convex directo.

### App usando Node

En la raíz de la app:

```dotenv
EXPO_PUBLIC_BACKEND_PROVIDER=node
EXPO_PUBLIC_API_URL=http://localhost:3001
```

En el teléfono, sustituye `localhost` por una dirección del Mac alcanzable desde el móvil; en producción, configura HTTPS y el origen correspondiente en `CORS_ORIGINS`.

El servidor necesita además su propio `shopp-node-postgres/.env` con PostgreSQL, autenticación y CORS correctamente configurados.

## 5. Reglas para proteger los archivos

- No guardes secretos de servidor en la raíz de Expo. Coloca las claves de Node en `shopp-node-postgres/.env` y las de Convex en el entorno del deployment Convex.
- No compartas ni subas `.env`, `.env.local` o `shopp-node-postgres/.env` a Git. Usa los archivos `.env.example` como plantillas, sustituyendo todos sus marcadores.
- Después de cambiar variables de Expo, reinicia Metro para que las vuelva a leer. Después de cambiar el `.env` del servidor, reinicia los servicios Docker.
- Si se cambia `POSTGRES_PASSWORD` para una base existente, actualiza también la contraseña del rol en PostgreSQL; editar el archivo por sí solo no basta.
