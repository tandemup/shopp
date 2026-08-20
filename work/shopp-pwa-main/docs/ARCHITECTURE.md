# Documentación técnica de Shopp

Shopp es una aplicación Expo/React Native para iOS, Android y Web/PWA. Sus áreas funcionales son listas de compra, tiendas, escáner, productos, chat, aparcamiento, perfil y administración.

`App.js` crea el cliente Convex y los proveedores React. `AppNavigator` separa autenticación y aplicación principal. `MainTabs` carga los stacks de compras, tiendas, chat, scanner y menú.

Convex gestiona autenticación, datos compartidos, consultas reactivas, mutaciones y autorización. El almacenamiento local usa una fachada común: IndexedDB en Web y AsyncStorage/Expo File System en nativo.

La variable obligatoria es `EXPO_PUBLIC_CONVEX_URL`. Comandos: `npm install`, `npx convex dev`, `npm start`, `npm run web` y `npm run build`.

La PWA usa `public/manifest.webmanifest`, `public/sw.js`, `public/_redirects` y `netlify.toml`. El service worker cachea el shell, pero las consultas Convex necesitan red salvo que exista una caché local específica.

Música y Google Drive están fuera del alcance aprobado y cualquier resto debe eliminarse o marcarse como histórico.
