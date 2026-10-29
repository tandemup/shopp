# Desarrollo y despliegue

> **Estado documental:** consolidación del ZIP `md(1).zip` (29-10-2026). La documentación técnica base fue elaborada en revisiones anteriores (principalmente septiembre de 2026); **no implica una auditoría del código vigente**. Revisar rutas, versiones y comportamiento contra el repositorio antes de aplicar cambios.

## Desarrollo local

## 1. Requisitos

- Node.js y npm.
- Proyecto Convex disponible.
- Expo toolchain.
- Navegador moderno para PWA/WebRTC.
- Dispositivo o simulador para pruebas nativas.

Netlify está configurado con **Node 24** para build.

## 2. Instalación

```bash
npm install
```

Copia `.env.example` a `.env.local` y configura al menos:

```env
EXPO_PUBLIC_CONVEX_URL=https://TU_DEPLOYMENT.convex.cloud
```

## 3. Desarrollo en dos terminales

Terminal 1 — backend:

```bash
npx convex dev
```

Terminal 2 — cliente:

```bash
npx expo start -c
```

No es necesario que `npx convex dev` termine: es un proceso de desarrollo que permanece escuchando cambios. Por eso se ejecuta en una terminal separada.

## 4. Scripts npm definidos

```bash
npm start
npm run start:clean
npm run android
npm run ios
npm run web
npm run build
```

Equivalencias relevantes:

- `start`: `expo start`
- `start:clean`: `expo start -c`
- `web`: `expo start --web`
- `build`: `expo export --platform web`

También hay scripts de datos Factory:

```bash
npm run factory:export
npm run factory:import
npm run factory:reset
```

## 5. Variables públicas de frontend detectadas

```text
EXPO_PUBLIC_CONVEX_URL
EXPO_PUBLIC_APP_VERSION
EXPO_PUBLIC_NETLIFY_SITE_NAME
EXPO_PUBLIC_SOCKET_URL
EXPO_PUBLIC_FIREALARM_TURN_URL
EXPO_PUBLIC_FIREALARM_TURN_USERNAME
EXPO_PUBLIC_FIREALARM_TURN_CREDENTIAL
```

Toda variable `EXPO_PUBLIC_*` puede terminar en el bundle del navegador. **No debe contener secretos permanentes.**

`EXPO_PUBLIC_SOCKET_URL` corresponde a infraestructura histórica/legacy según `.env.example` y `config/env.js`; Convex es el backend principal actual.

## 6. Variables de backend detectadas

Entre las referencias del repositorio aparecen:

```text
AUTH_RESEND_KEY
CONVEX_SITE_URL
OPENAI_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
```

También aparecen nombres legacy/auxiliares como `DATABASE_URL`, `APP_TOKEN`, `OWNER_KEY`, `CLIENT_ORIGIN`, `PORT`, `PGSSL` en partes del árbol. Antes de utilizarlos, confirmar que el fichero correspondiente forma parte del runtime actual y no de código histórico.

Para Convex, un secreto se configura normalmente en el deployment, por ejemplo:

```bash
npx convex env set AUTH_RESEND_KEY "..."
```

## 7. Alias `@/`

El proyecto usa imports como:

```js
import { api } from "@/convex/_generated/api";
import { storage } from "@/src/storage";
```

Por tanto, al mover código o configurar herramientas externas hay que respetar `jsconfig.json` / `tsconfig.json` y la resolución de alias.

## 8. Flujo recomendado al modificar una utilidad

1. Localizar pantalla en `src/screens/<dominio>/`.
2. Revisar su stack y ruta en `src/navigation/`.
3. Revisar hooks/context/services usados.
4. Determinar si el dato es local, remoto o híbrido.
5. Si usa Convex, revisar schema e índices antes de modificar queries.
6. Mantener autorización backend.
7. Probar Web y al menos una plataforma nativa si el cambio toca APIs de Expo.
8. Ejecutar tests.
9. Ejecutar build web antes de desplegar.

## 9. Convenciones prácticas observadas

- JavaScript como lenguaje principal de UI.
- TypeScript presente para configuración/generados de Convex, pero no como estilo dominante de pantallas.
- Componentes específicos por plataforma cuando hace falta (`.web.js`, `.native.js`).
- `safeAlert` abstrae diálogos nativos vs web.
- `Platform.OS` se usa ampliamente para degradación progresiva de capacidades.

## 10. Limpieza de caché

Ante inconsistencias de Metro/Expo:

```bash
npx expo start -c
```

Si el problema está en schema/functions de Convex, mantener también `npx convex dev` ejecutándose para regenerar y sincronizar las funciones.


---

## Despliegue: PWA, Netlify y EAS

## 1. Web/PWA

### Build

`netlify.toml` define:

```toml
[build]
command = "npx expo export -p web"
publish = "dist"
```

El script npm equivalente es:

```bash
npm run build
```

### Node

Netlify fija:

```toml
NODE_VERSION = "24"
```

Conviene reproducir esa major version en CI/local al investigar diferencias de build.

### SPA routing

Netlify redirige cualquier ruta a `index.html`:

```toml
[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

Esto permite que React Navigation maneje rutas cliente sin 404 al recargar.

## 2. Configuración PWA

`app.json` configura Web con:

- `output: single`;
- bundler Metro;
- display `standalone`;
- idioma `es`;
- scope `/`;
- start URL `/`;
- orientación portrait-primary.

El repositorio contiene además:

- `public/manifest.webmanifest`;
- `public/sw.js`;
- `public/_redirects`.

## 3. Headers de seguridad actuales

Netlify añade:

```text
Permissions-Policy: camera=(self), microphone=()
X-Content-Type-Options: nosniff
```

### Conflicto funcional detectado

`LiveCameraWeb.js` solicita:

```js
getUserMedia({ video: ..., audio: true })
```

pero el header de Netlify define:

```text
microphone=()
```

Eso deshabilita el micrófono para el documento, aunque el usuario haya dado permiso al navegador. Si **Shopp Live debe transmitir audio**, este header debe cambiarse de forma controlada, por ejemplo permitiendo micrófono a `self`.

Fire Alarm no tiene este conflicto porque su implementación actual solicita `audio: false`.

## 4. Variables de entorno en producción web

Como mínimo:

```text
EXPO_PUBLIC_CONVEX_URL
```

Opcionales según funcionalidad:

```text
EXPO_PUBLIC_APP_VERSION
EXPO_PUBLIC_NETLIFY_SITE_NAME
EXPO_PUBLIC_FIREALARM_TURN_URL
EXPO_PUBLIC_FIREALARM_TURN_USERNAME
EXPO_PUBLIC_FIREALARM_TURN_CREDENTIAL
```

No introducir secretos de API permanentes en variables `EXPO_PUBLIC_*`.

## 5. Service worker

`/sw.js` se publica con:

```text
Cache-Control: no-cache
```

Esto facilita que el navegador compruebe actualizaciones del service worker. El manifiesto tiene caché de una hora.

Después de un despliegue, validar:

- que se descarga el bundle nuevo;
- que no queda una versión antigua controlada por un service worker previo;
- que autenticación/Convex apuntan al deployment correcto.

## 6. Checklist de despliegue PWA

1. `npm install` limpio si se ha actualizado lockfile.
2. Confirmar `EXPO_PUBLIC_CONVEX_URL` de producción.
3. Desplegar/sincronizar Convex.
4. Ejecutar tests.
5. Ejecutar `npm run build`.
6. Probar `dist/` o deploy preview.
7. Verificar login/registro/OTP.
8. Verificar listas y persistencia local.
9. Verificar scanner/cámara en HTTPS.
10. Verificar Biblioteca con dataset realista.
11. Verificar Parking/geolocalización.
12. Verificar Shopp Live desde dos dispositivos si se ha tocado WebRTC.
13. Verificar instalación como PWA.

## 7. Builds nativas con EAS

`eas.json` define tres perfiles:

### development

- development client;
- distribución interna.

### preview

- distribución interna;
- Android APK.

### production

- auto incremento;
- Android App Bundle.

El proyecto EAS está asociado mediante `extra.eas.projectId` en `app.json`.

## 8. Identificadores de aplicación

### iOS

```text
com.ramnworksshopp.shopp
```

### Android

```text
com.ramnworksshopp.shopp
```

## 9. Permisos nativos declarados

Android declara:

- CAMERA
- RECORD_AUDIO
- ACCESS_COARSE_LOCATION
- ACCESS_FINE_LOCATION

Los plugins Expo incluyen mensajes de permiso de cámara, micrófono y ubicación.


---

## Instrucciones adicionales de instalación

### Utilidad de supermercados para Shopp

1. Copia las carpetas `src`, `convex` y `data` sobre la raíz del proyecto.
2. Ejecuta `npx convex dev` para desplegar el esquema y regenerar la API.
3. Entra con un administrador en `Settings > Catálogo de supermercados`.
4. Importa `data/stores.json` usando **Combinar**. El archivo contiene las 19 tiendas que estaban en `src/constants/stores.js`.

## Flujos incluidos

- Los compradores pueden proponer supermercados con ubicación GPS.
- El administrador revisa la propuesta; al aprobarla se crea en `stores` o se enlaza con un duplicado existente.
- Los compradores pueden comunicar ofertas observadas.
- Los propietarios pueden enviar solicitudes comerciales con datos de contacto.
- El administrador aprueba o rechaza ofertas y solicitudes.
- Solo las ofertas aprobadas aparecen en `Tiendas > Ofertas de supermercados`.
- El catálogo puede exportarse e importarse con el formato `shopp-supermarkets`, versión 1.

La importación **Combinar** conserva el catálogo y actualiza por `id`. **Reemplazar todo** elimina primero las tiendas actuales; úsala solo con una copia exportada y revisada.

## Consideraciones Git y despliegue

Las referencias antiguas a Heroku/PostgreSQL/Socket.IO conservadas en `historico/legado` no son instrucciones vigentes. Confirmar comando de build y directorio de publicación en `package.json` y configuración Netlify del repositorio actual.
