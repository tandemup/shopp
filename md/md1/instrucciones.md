# Instrucciones de cambios y despliegue — `shopp` y `shopp-server`

Este documento define el procedimiento recomendado cuando se introduzcan cambios en los repositorios de GitHub:

- `shopp`: aplicación Expo / React Native / Web desplegada en Netlify.
- `shopp-server`: servidor Node.js / Express / Socket.IO desplegado en Heroku.

El objetivo es evitar cambios rotos en producción, mantener GitHub como repositorio principal y desplegar correctamente el servidor de sockets en Heroku.

---

## 1. Reglas generales

### Antes de modificar código

1. Abrir el proyecto correcto en VS Code.
2. Comprobar la rama activa.
3. Descargar los últimos cambios desde GitHub.
4. Crear una rama de trabajo si el cambio no es trivial.
5. Probar localmente antes de hacer `push`.
6. No guardar claves, tokens ni URLs privadas directamente en el código.
7. Usar variables de entorno para URLs públicas, claves y configuración sensible.

Comandos generales:

```bash
git status
git branch
git pull origin main
```

Para crear una rama de trabajo:

```bash
git checkout -b nombre-de-la-rama
```

Ejemplo:

```bash
git checkout -b fix-socket-heroku
```

---

## 2. Repositorio `shopp`

`shopp` es la app Expo / React Native / Web. Se despliega en Netlify desde GitHub.

### 2.1. Qué revisar antes de cambiar `shopp`

Antes de modificar el cliente, revisar especialmente:

- Rutas de navegación.
- Pantallas que usan socket.
- Variables de entorno.
- Compatibilidad Web / iOS / Android.
- Conexión con `shopp-server`.
- Uso de `SOCKET_SERVER_URL`.
- Ficheros relacionados con configuración, por ejemplo:

```text
env.js
services/chatSocket.js
screens/chat/...
navigation/...
```

---

## 3. Configuración del socket en `shopp`

La app cliente no debe tener una URL de Heroku escrita directamente de forma rígida en todos los componentes.

Debe usarse una variable de entorno pública de Expo:

```bash
EXPO_PUBLIC_SOCKET_URL=https://NOMBRE-DE-TU-APP.herokuapp.com
```

Ejemplo:

```bash
EXPO_PUBLIC_SOCKET_URL=https://shopp-server-7aaea79b71f2.herokuapp.com
```

En desarrollo local web puede usarse:

```bash
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
```

En Expo Go sobre teléfono físico debe usarse la IP LAN del Mac, no `localhost`:

```bash
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.50:3000
```

Importante:

```text
localhost en un móvil apunta al propio móvil, no al Mac.
```

---

## 4. Cambios en `shopp`

### 4.1. Flujo recomendado

Desde la carpeta del proyecto `shopp`:

```bash
cd ruta/al/proyecto/shopp
git status
git pull origin main
npm install
npm run web
```

Después de modificar código:

```bash
git status
git diff
npm run web
```

Si todo funciona:

```bash
git add .
git commit -m "Describe el cambio realizado"
git push origin main
```

Si se trabaja con rama:

```bash
git push origin nombre-de-la-rama
```

Después se puede abrir un Pull Request en GitHub y hacer merge a `main`.

---

## 5. Despliegue de `shopp` en Netlify

Si Netlify está conectado al repositorio `shopp`, normalmente basta con hacer:

```bash
git push origin main
```

Netlify detectará el cambio, ejecutará el build y publicará la nueva versión.

### 5.1. Variable de entorno en Netlify

En Netlify debe configurarse:

```bash
EXPO_PUBLIC_SOCKET_URL=https://NOMBRE-DE-TU-APP.herokuapp.com
```

Ejemplo:

```bash
EXPO_PUBLIC_SOCKET_URL=https://shopp-server-7aaea79b71f2.herokuapp.com
```

No confiar en `localhost` cuando la app está en Netlify.

### 5.2. Comprobación tras desplegar en Netlify

Después del deploy:

1. Abrir la URL pública de Netlify.
2. Abrir la pantalla de Chat.
3. Comprobar en la consola del navegador si conecta con Heroku.
4. Comprobar los logs de Heroku:

```bash
heroku logs --tail --app NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku logs --tail --app shopp-server-7aaea79b71f2
```

---

## 6. Repositorio `shopp-server`

`shopp-server` es el servidor Node.js / Express / Socket.IO que se despliega en Heroku.

### 6.1. Reglas importantes para Heroku

El servidor no debe escuchar siempre en el puerto `3000`.

Debe usar:

```js
const PORT = process.env.PORT || 3000;
```

Correcto:

```js
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

Heroku asigna dinámicamente el puerto mediante `process.env.PORT`.

---

## 7. Ficheros mínimos recomendados en `shopp-server`

En el repositorio `shopp-server` debería existir:

```text
package.json
package-lock.json
index.js
Procfile
.gitignore
```

### 7.1. `package.json`

Debe tener un script `start`:

```json
{
  "scripts": {
    "start": "node index.js"
  }
}
```

### 7.2. `Procfile`

En la raíz del proyecto:

```text
web: npm start
```

### 7.3. `.gitignore`

Ejemplo:

```text
node_modules
.env
.DS_Store
npm-debug.log
```

---

## 8. Cambios en `shopp-server`

### 8.1. Flujo recomendado

Desde la carpeta del servidor:

```bash
cd ruta/al/proyecto/shopp-server
git status
git pull origin main
npm install
npm start
```

Probar localmente que el servidor funciona:

```bash
curl http://localhost:3000
```

Después de modificar código:

```bash
git status
git diff
npm start
```

Si todo funciona:

```bash
git add .
git commit -m "Describe el cambio realizado"
git push origin main
```

---

## 9. Despliegue de `shopp-server` en Heroku

Hay dos formas habituales:

1. Despliegue automático desde GitHub.
2. Despliegue manual con Heroku CLI.

Para este proyecto se recomienda mantener GitHub como repositorio principal y usar Heroku como destino de despliegue.

---

# 10. Comandos Heroku CLI

## 10.1. Instalar Heroku CLI en macOS

Con Homebrew:

```bash
brew tap heroku/brew
brew install heroku
```

Comprobar instalación:

```bash
heroku --version
```

---

## 10.2. Login en Heroku

```bash
heroku login
```

Si hay problemas con navegador o sesión:

```bash
heroku login -i
```

---

## 10.3. Ver apps de Heroku

```bash
heroku apps
```

---

## 10.4. Crear una app nueva en Heroku

Desde la carpeta del servidor:

```bash
heroku create NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku create shopp-server
```

Heroku puede exigir un nombre único. Si el nombre ya existe, usar otro.

Ejemplo con nombre generado o personalizado:

```bash
heroku create shopp-server-josh
```

---

## 10.5. Conectar un repo local con una app existente de Heroku

Si la app ya existe en Heroku:

```bash
heroku git:remote --app NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku git:remote --app shopp-server-7aaea79b71f2
```

Comprobar remotos:

```bash
git remote -v
```

Deberías ver algo parecido a:

```text
origin  https://github.com/USUARIO/shopp-server.git
heroku  https://git.heroku.com/NOMBRE-DE-TU-APP.git
```

---

## 10.6. Desplegar en Heroku con Git

Desde la carpeta `shopp-server`:

```bash
git push heroku main
```

Si tu rama local se llama `master`:

```bash
git push heroku master:main
```

Si estás en una rama distinta y quieres desplegarla a Heroku:

```bash
git push heroku nombre-de-la-rama:main
```

---

## 10.7. Ver logs de Heroku

Ver logs en tiempo real:

```bash
heroku logs --tail --app NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku logs --tail --app shopp-server-7aaea79b71f2
```

Ver últimos logs sin dejar la terminal abierta:

```bash
heroku logs --app NOMBRE-DE-TU-APP
```

---

## 10.8. Abrir la app de Heroku en el navegador

```bash
heroku open --app NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku open --app shopp-server-7aaea79b71f2
```

---

## 10.9. Ver procesos/dynos

```bash
heroku ps --app NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku ps --app shopp-server-7aaea79b71f2
```

---

## 10.10. Reiniciar la app

```bash
heroku restart --app NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku restart --app shopp-server-7aaea79b71f2
```

---

## 10.11. Escalar el dyno web

Activar un dyno web:

```bash
heroku ps:scale web=1 --app NOMBRE-DE-TU-APP
```

Parar el dyno web:

```bash
heroku ps:scale web=0 --app NOMBRE-DE-TU-APP
```

---

## 10.12. Variables de entorno en Heroku

Ver variables:

```bash
heroku config --app NOMBRE-DE-TU-APP
```

Añadir o modificar variable:

```bash
heroku config:set NOMBRE_VARIABLE=valor --app NOMBRE-DE-TU-APP
```

Ejemplo para CORS:

```bash
heroku config:set CLIENT_ORIGIN=https://TU-SITIO.netlify.app --app shopp-server-7aaea79b71f2
```

Eliminar variable:

```bash
heroku config:unset NOMBRE_VARIABLE --app NOMBRE-DE-TU-APP
```

---

## 10.13. Ejecutar comandos dentro de Heroku

Abrir consola bash:

```bash
heroku run bash --app NOMBRE-DE-TU-APP
```

Ejecutar un comando puntual:

```bash
heroku run node -v --app NOMBRE-DE-TU-APP
```

---

## 10.14. Ver releases

```bash
heroku releases --app NOMBRE-DE-TU-APP
```

Ver una release concreta:

```bash
heroku releases:info vNUMERO --app NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku releases:info v12 --app shopp-server-7aaea79b71f2
```

---

## 10.15. Rollback a una release anterior

```bash
heroku rollback vNUMERO --app NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku rollback v11 --app shopp-server-7aaea79b71f2
```

Después del rollback, revisar logs:

```bash
heroku logs --tail --app NOMBRE-DE-TU-APP
```

---

## 10.16. Renombrar una app de Heroku

```bash
heroku apps:rename NUEVO-NOMBRE --app NOMBRE-ACTUAL
```

Ejemplo:

```bash
heroku apps:rename shopp-server-prod --app shopp-server-7aaea79b71f2
```

Después de renombrar, revisar el remoto:

```bash
git remote -v
```

Si hace falta, volver a conectar:

```bash
heroku git:remote --app NUEVO-NOMBRE
```

---

## 10.17. Eliminar una app de Heroku

Usar con cuidado.

```bash
heroku apps:destroy --app NOMBRE-DE-TU-APP --confirm NOMBRE-DE-TU-APP
```

Ejemplo:

```bash
heroku apps:destroy --app shopp-server-7aaea79b71f2 --confirm shopp-server-7aaea79b71f2
```

---

# 11. Flujo completo recomendado para `shopp-server`

## 11.1. Cambio local + GitHub + Heroku

```bash
cd ruta/al/proyecto/shopp-server

git status
git pull origin main

npm install
npm start
```

En otra terminal:

```bash
curl http://localhost:3000
```

Si todo funciona:

```bash
git add .
git commit -m "Actualiza servidor socket"
git push origin main
git push heroku main
```

Revisar logs:

```bash
heroku logs --tail --app NOMBRE-DE-TU-APP
```

---

# 12. Flujo completo recomendado para `shopp`

## 12.1. Cambio local + GitHub + Netlify

```bash
cd ruta/al/proyecto/shopp

git status
git pull origin main

npm install
npm run web
```

Si todo funciona:

```bash
git add .
git commit -m "Actualiza cliente Shopp"
git push origin main
```

Después:

1. Esperar a que Netlify termine el deploy.
2. Abrir la app web en Netlify.
3. Probar la pantalla de Chat.
4. Revisar logs en Heroku:

```bash
heroku logs --tail --app NOMBRE-DE-TU-APP
```

---

# 13. Comprobaciones específicas del chat Socket.IO

## 13.1. En local

Servidor:

```bash
cd shopp-server
npm start
```

Cliente web:

```bash
cd shopp
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000 npm run web
```

En Expo Go con teléfono físico:

```bash
EXPO_PUBLIC_SOCKET_URL=http://IP-LAN-DEL-MAC:3000 npx expo start
```

Ejemplo:

```bash
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.50:3000 npx expo start
```

---

## 13.2. En producción

En Netlify:

```bash
EXPO_PUBLIC_SOCKET_URL=https://NOMBRE-DE-TU-APP.herokuapp.com
```

En Heroku:

```bash
heroku logs --tail --app NOMBRE-DE-TU-APP
```

Comprobar:

- El cliente no intenta conectar a `localhost`.
- El servidor usa `process.env.PORT`.
- El servidor permite el origen de Netlify en CORS.
- No hay errores de CORS en la consola del navegador.
- No hay errores de Socket.IO en logs de Heroku.

---

# 14. Checklist antes de hacer `push`

## 14.1. Para `shopp`

- [ ] La app arranca localmente.
- [ ] No hay errores en consola.
- [ ] La URL del socket viene de `EXPO_PUBLIC_SOCKET_URL`.
- [ ] No se ha dejado `localhost` fijo en producción.
- [ ] Se ha probado Web si el cambio afecta Netlify.
- [ ] Se ha probado Expo Go si el cambio afecta móvil.
- [ ] `git status` muestra solo los ficheros esperados.

## 14.2. Para `shopp-server`

- [ ] El servidor arranca con `npm start`.
- [ ] Usa `process.env.PORT || 3000`.
- [ ] Existe `Procfile`.
- [ ] Existe script `start` en `package.json`.
- [ ] No se ha subido `.env`.
- [ ] CORS permite la URL de Netlify.
- [ ] `git status` muestra solo los ficheros esperados.
- [ ] Heroku responde después del deploy.
- [ ] Los logs no muestran errores críticos.

---

# 15. Diagnóstico rápido de errores

## 15.1. Netlify carga pero el chat no conecta

Revisar en `shopp`:

```bash
EXPO_PUBLIC_SOCKET_URL
```

Revisar consola del navegador:

```text
CORS error
websocket error
failed to connect
localhost:3000
```

Si aparece `localhost:3000` en Netlify, la variable de entorno está mal configurada o no se ha reconstruido la app.

Solución:

1. Corregir variable en Netlify.
2. Lanzar nuevo deploy.
3. Comprobar de nuevo.

---

## 15.2. Heroku no arranca

Ver logs:

```bash
heroku logs --tail --app NOMBRE-DE-TU-APP
```

Revisar:

```bash
package.json
Procfile
process.env.PORT
```

Errores típicos:

```text
Error R10 Boot timeout
Cannot find module
Missing script: start
Cannot GET /
EADDRINUSE
```

---

## 15.3. Error de puerto

Incorrecto:

```js
server.listen(3000);
```

Correcto:

```js
const PORT = process.env.PORT || 3000;
server.listen(PORT);
```

---

## 15.4. Error de CORS

En el servidor revisar configuración de Socket.IO:

```js
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});
```

En Heroku:

```bash
heroku config:set CLIENT_ORIGIN=https://TU-SITIO.netlify.app --app NOMBRE-DE-TU-APP
```

---

# 16. Comandos útiles de Git

Ver estado:

```bash
git status
```

Ver diferencias:

```bash
git diff
```

Añadir cambios:

```bash
git add .
```

Commit:

```bash
git commit -m "Mensaje claro del cambio"
```

Subir a GitHub:

```bash
git push origin main
```

Traer cambios:

```bash
git pull origin main
```

Ver ramas:

```bash
git branch
```

Crear rama:

```bash
git checkout -b nombre-rama
```

Cambiar de rama:

```bash
git checkout main
```

Fusionar rama en `main`:

```bash
git checkout main
git pull origin main
git merge nombre-rama
git push origin main
```

---

# 17. Recomendación de trabajo

Para cambios pequeños:

```text
Modificar → probar local → commit → push GitHub → deploy automático/manual.
```

Para cambios importantes:

```text
Crear rama → modificar → probar → push rama → Pull Request → merge a main → deploy.
```

Para `shopp-server`, después de mergear o subir a `main`, comprobar Heroku:

```bash
git push heroku main
heroku logs --tail --app NOMBRE-DE-TU-APP
```

Para `shopp`, después de subir a `main`, comprobar Netlify y después los logs del servidor:

```bash
heroku logs --tail --app NOMBRE-DE-TU-APP
```

---

# 18. Fuentes oficiales consultadas

- Heroku CLI:
  https://devcenter.heroku.com/articles/heroku-cli

- Heroku CLI Commands:
  https://devcenter.heroku.com/articles/heroku-cli-commands

- Deploying with Git:
  https://devcenter.heroku.com/articles/git

- Deploying Node.js Apps on Heroku:
  https://devcenter.heroku.com/articles/deploying-nodejs

- Procfile:
  https://devcenter.heroku.com/articles/procfile

- GitHub Integration:
  https://devcenter.heroku.com/articles/github-integration

- Releases and Rollback:
  https://devcenter.heroku.com/articles/releases
