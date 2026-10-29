# Funcionalidades de Shopp

> **Estado documental:** consolidación del ZIP `md(1).zip` (29-10-2026). La documentación técnica base fue elaborada en revisiones anteriores (principalmente septiembre de 2026); **no implica una auditoría del código vigente**. Revisar rutas, versiones y comportamiento contra el repositorio antes de aplicar cambios.

## Visión general

## 1. Propósito

Shopp es una aplicación personal/colaborativa orientada inicialmente a organizar compras y que ha evolucionado hacia una PWA modular con servicios asociados a productos, enlaces, comunicación y geolocalización.

La intención técnica del proyecto es mantener **una sola base de código JavaScript** para:

- iOS;
- Android;
- navegador web;
- instalación como PWA.

## 2. Superficies principales de usuario

La navegación principal autenticada se divide en cinco pestañas:

1. **Shopping**
2. **Tiendas**
3. **Chat**
4. **Scanner**
5. **Menu**

Desde el stack de Shopping se exponen además utilidades como:

- Fire Alarm;
- Tutor de Inglés;
- Biblioteca;
- Play List;
- Shopp Live.

Sin sesión, `AppNavigator` presenta el stack de autenticación.

## 3. Capacidades actuales

### Shopping

- múltiples listas de compra;
- items con cantidad, unidad y precio;
- categorías y subcategorías;
- selección de tienda;
- promociones y ahorro;
- archivado;
- histórico de compras.

### Scanner y productos

- lectura de códigos de barras en móvil y web;
- entrada/edición manual;
- historial local y sincronización opcional con Convex;
- caché compartida de producto;
- revisión administrativa de aportaciones;
- imágenes de producto locales y temporales remotas;
- tipos principales: **Alimentos, Supermercado, Libros, Música**.

### Tiendas y Parking

- catálogo de tiendas;
- favoritos por usuario;
- tiendas cercanas;
- uso de geolocalización;
- destinos de Parking;
- presencia y estados de usuario;
- plazas compartidas y eventos de aparcamiento;
- estadísticas y notificaciones asociadas.

### Chat

- salas;
- mensajes en tiempo real;
- alias de usuario;
- imágenes;
- contenido de producto;
- YouTube y playlists;
- análisis y estado de URLs;
- moderación y borrado por usuario/administrador;
- caducidad de mensajes mediante cron.

### Biblioteca

- carpetas jerárquicas;
- enlaces generales;
- noticias;
- fuentes/periódicos;
- tiendas y enlaces de libros;
- títulos personalizados;
- notas;
- hashtags;
- favoritos;
- fecha de publicación;
- búsqueda y ordenación;
- importación/exportación;
- trabajos de importación reanudables.

### Play List

- playlists propias por usuario;
- singles y álbumes/listas de YouTube;
- letras almacenables como ficheros.

### Shopp Live

- canales de emisión;
- modo URL de reproducción externa;
- modo cámara en PWA;
- WebRTC entre emisor y espectadores;
- señalización mediante Convex;
- `RTCDataChannel` bidireccional;
- límite visual/funcional de hasta 4 espectadores en la implementación de cámara.

### Fire Alarm

- activación desde cámara web/PWA;
- creación de alarma en Convex;
- snapshot opcional;
- WebRTC P2P para vídeo;
- STUN por defecto y TURN opcional;
- administración/acuse/resolución de alarmas.

### Cuenta y administración

- registro con contraseña;
- verificación OTP por correo;
- recuperación OTP por correo;
- roles `user` / `admin`;
- perfil y alias;
- gestión de usuarios por administrador;
- revisión de productos aportados.

## 4. Plataformas

| Capacidad | Web/PWA | iOS | Android |
|---|---:|---:|---:|
| Listas | Sí | Sí | Sí |
| Convex/Auth | Sí | Sí | Sí |
| Biblioteca | Sí | Sí, con diferencias de almacenamiento/importación | Sí, con diferencias de almacenamiento/importación |
| Cámara scanner | Sí, si el navegador lo permite | Sí | Sí |
| Ubicación | Sí | Sí | Sí |
| Shopp Live cámara | Sí | No en la implementación actual | No en la implementación actual |
| Fire Alarm cámara | Sí | No en la fase actual | No en la fase actual |
| PWA instalable | Sí | N/A como web instalada | N/A como web instalada |

## 5. Decisiones de diseño relevantes

- **Backend reactivo**: Convex evita implementar un socket server separado para el estado compartido convencional.
- **WebRTC no transporta vídeo por Convex**: Convex actúa como plano de señalización; el media stream circula P2P o por TURN.
- **Offline parcial**: existe persistencia local, pero las consultas remotas no se convierten automáticamente en offline.
- **Autorización backend**: las operaciones sensibles deben validar usuario/rol en Convex, no solo ocultar controles en UI.
- **PWA y nativo comparten código**, pero determinadas capacidades se aíslan por `Platform.OS` o archivos `.web.js` / `.native.js`.


---

## Módulos funcionales

## 1. Shopping

**Pantallas principales**

- `ShoppingListsScreen.js`
- `ShoppingListScreen.js`
- `ItemDetailScreen.js`
- `ArchivedListsScreen.js`
- `PurchaseHistoryScreen.js`
- `PurchaseDetailScreen.js`

**Estado principal**

- `ListsContext`
- persistencia local bajo `src/storage`

**Responsabilidades**

- CRUD de listas;
- items de compra;
- cantidades/unidades/precios;
- categorías;
- promociones;
- asociación con tienda;
- archivado e histórico.

## 2. Scanner y productos

**Pantallas**

- `ScannerTabScreen.js`
- `ProductBarcodeScannerScreen.js`
- `NewProductScannerScreen2.js`
- `EditScannedItemScreen.js`
- `ScannedHistoryScreen.js`

**Tipos de producto**

Definidos en `src/constants/productSearchTypes.js`:

- Alimentos
- Supermercado
- Libros
- Música

El tipo por defecto es **Alimentos**.

**Piezas técnicas**

- `barcodeNormalization.js`
- `scannedProductModel.js`
- `scannerHistory.js`
- `scannedHistorySync.js`
- `useScannedHistoryStorage.js`
- `useScanHistoryConvex.js`
- `productLookup.js`
- `productCache.js` (Convex)

**Persistencia**

El proyecto tiene varias generaciones de datos de scanner:

- historial local canónico;
- `userScanHistory` para historial por usuario sincronizable;
- `scanHistory` como tabla más simple/legacy;
- `barcodeScans` para lecturas con consentimiento;
- `productCache` para datos reutilizables por barcode;
- `productReviewSubmissions` para cambios pendientes de aprobación.

Conviene considerar estas tablas como dominios distintos y evitar tratarlas como si fueran una sola colección.

## 3. Tiendas

**Pantallas**

- Home
- Browse
- Favorites
- Nearby
- Detail
- Info
- Select

**Backend**

- `convex/stores.js`
- `convex/storeFavorites.js`

**Modelo**

`stores` contiene el catálogo. `userStoreFavorites` mantiene la relación usuario-tienda; el campo `stores.favorite` está marcado en schema como heredado y no debe ser la fuente canónica para favoritos personales.

## 4. Parking

**Pantallas**

- `ParkingScreen.js`
- `ParkingSettingsScreen.js`
- `ParkingGpsDebugScreen.js`
- `ParkingSpotsSection.js`

**Backend**

- `convex/parking.js`

**Tablas relacionadas**

- `parkingPresence`
- `parkingDestinations`
- `parkingGpsMeasurements`
- `parkingSpots`
- `parkingWatchers`
- `parkingNotifications`
- `parkingAreaStats`
- `parkingMessages`

Parking combina datos efímeros (presencia), datos permanentes (destinos), eventos/plazas compartidas y telemetría/estadísticas.

## 5. Chat

**Pantallas**

- `ChatScreen.js`
- `ChatScreenResponsive.js`
- `ChatPrototypeScreen.js`
- `YesterdayNewsScreen.js`

**Backend**

- `convex/chat.js`
- `convex/linkPreviews.js`

**Capacidades detectadas**

- sala;
- usuario/alias;
- texto;
- imágenes en Convex Storage;
- referencias de producto;
- álbum/playlists de YouTube;
- extracción y clasificación de URLs;
- estados de seguridad para URLs;
- estados de moderación;
- borrado por propietario o administrador;
- TTL de mensajes.

El backend define `MESSAGE_TTL_MS = 24 horas`; el cron de limpieza corre cada hora. Si el producto pretende conservar mensajes indefinidamente, esta política debe revisarse en código backend.

## 6. Biblioteca

**Pantalla principal**

- `src/screens/library/LibraryScreen.js`

Existe además `src/screens/chat/LibraryScreen.js`, por lo que hay que evitar confundir ambas implementaciones al mantener el proyecto.

**Backend**

- `convex/computerLinks.js`

**Entidades**

### Carpetas

`computerLinkFolders` permite jerarquía mediante `parentFolderId`.

Carpetas raíz predeterminadas presentes en backend:

- Noticias
- Libros
- Informática
- Política
- Ingeniería
- Música

### Enlaces

`computerLinks.linkType` distingue:

- `general`
- `newsSource`
- `newsArticle`
- `bookStore`
- `bookLink`

Campos importantes:

- URL original/canónica;
- hostname;
- carpeta;
- fuente/dominio;
- título personalizado;
- favorito;
- estado;
- notas;
- hashtags;
- fecha de publicación;
- fechas de creación/actualización.

### Importación

La pantalla persiste el payload de importación en IndexedDB (Web) o FileSystem (nativo) y el progreso remoto en `libraryImportJobs`.

Constantes relevantes de la implementación actual:

- vista inicial limitada a 80 enlaces;
- hasta 600 fuentes de catálogo en ciertos flujos;
- página de búsqueda: 40;
- escaneo de hashtags por lotes/páginas;
- importaciones enriquecidas con límite específico.

No debe confundirse el límite de elementos **renderizados/consultados en una vista** con el número total de enlaces almacenados en Convex.

## 7. Play List

**Pantalla**

- `src/screens/playlist/PlayListScreen.js`

**Backend**

- `convex/playlists.js`

**Tabla**

`youtubePlaylists` guarda una playlist por propietario con tracks de tipo single/album, URL, IDs de YouTube y letras opcionales en Convex Storage.

## 8. Shopp Live

**Pantallas**

- `ShoppLiveScreen.js`
- `LiveCameraWeb.js`

**Backend**

- `convex/live.js`

**Modos**

1. **External**: reproducción mediante URL (vídeo directo/iframe).
2. **Camera**: captura `getUserMedia()` y WebRTC.

**WebRTC camera**

- vídeo 1280×720 ideal;
- audio activado (`audio: true`);
- un peer por sesión de viewer;
- `RTCDataChannel` llamado `shopp-live-data`;
- STUN: `stun:stun.l.google.com:19302`;
- estado de sesiones e ICE persistido temporalmente vía Convex.

La UI muestra la emisión de cámara como funcionalidad PWA; nativo presenta mensaje de no disponibilidad.

## 9. Fire Alarm

**Pantalla**

- `src/screens/webRtcFireAlarm/WebRtcFireAlarmScreen.js`

**Backend**

- `convex/fireAlarm.js`

**Tablas**

- `fireAlarms`
- `fireAlarmSignals`

**Características**

- cámara web/PWA;
- captura de vídeo sin audio;
- estados `pending`, `acknowledged`, `cancelled`, `resolved`;
- acceso del propietario y administrador;
- WebRTC con STUN;
- TURN opcional;
- snapshot en Convex Storage.

## 10. Perfil y administración

**Pantallas**

- `ProfileScreen.js`
- `AvatarEditorScreen.js`
- `AdminUsersScreen.js`
- `AdminProductReviewsScreen.js`

**Backend**

- `convex/users.js`
- `convex/productReviewSubmissions.js`
- `convex/lib/auth.js`

El perfil complementa la tabla Auth `users` con `userProfiles`, que contiene alias, avatar, teléfono, visibilidad y preferencia de sincronización del historial de escaneos.

## 11. Backup e import/export

Hay dos mecanismos conceptualmente distintos:

### Export JSON de usuario

`src/services/exportUserData.js` exporta listas, histórico, escaneos y perfil en JSON.

### Backup ZIP completo local

`src/services/backupZip.js` y `src/utils/zipStore.js` generan un ZIP con:

- `manifest.json`;
- `data.json`;
- imágenes locales;
- hashes SHA-256 cuando están disponibles;
- validación CRC del ZIP;
- restauración `merge` o `replace`.

El backup ZIP representa principalmente **estado local**; no es un volcado completo de todas las tablas de Convex.


---

## Guía de playlists (fuente histórica)

PLAYLISTS DE YOUTUBE CREADAS EN SHOPP

Archivos incluidos:
- convex/schema.js
- convex/chat.js
- src/screens/chat/ChatScreen.js
- src/components/chat/CustomYouTubePlaylistPlayer.js
- src/components/chat/CustomYouTubePlaylistPlayer.web.js

Después de copiar los archivos, publica el backend:

  npx convex dev --once

Para probar:
1. Abre Chat y selecciona YouTube.
2. Pulsa "Nueva playlist".
3. Escribe el nombre del concierto.
4. En cada elemento selecciona Single o Álbum.
5. Añade su título y enlace de YouTube.
6. Pulsa "Crear playlist".
7. Abre la card y selecciona cada single o álbum para reproducirlo.

La playlist debe contener entre 2 y 20 elementos.
Los Singles usan enlaces de vídeo individual y los Álbumes enlaces de playlist.

## Pruebas P2P (fuente histórica)

# Shopp · prueba de sincronización P2P de Biblioteca

Cambios principales:

- Dos dispositivos con la misma cuenta pueden aparecer como peers distintos.
- Cada navegador conserva un `deviceId` local en `localStorage`.
- La Biblioteca local se sincroniza por WebRTC `RTCDataChannel`.
- El JSON se divide en bloques de 48 KiB para Bibliotecas grandes.
- Sincronización bidireccional: el receptor combina y devuelve su estado actualizado.
- Conflictos de enlaces: gana el registro con `updatedAt` más reciente.
- Los enlaces archivados también se transfieren como tombstones para propagar eliminaciones.
- Convex se usa para presencia/señalización; los datos de Biblioteca viajan directamente P2P.

## Antes de probar

Este ZIP modifica el esquema y las funciones Convex. Despliega/actualiza Convex antes de probar la PWA:

    npx convex dev

Para producción, usa el flujo habitual de deploy de Convex del proyecto.

## Prueba MacBook ↔ iPad

1. Abre Shopp en ambos dispositivos con la misma cuenta.
2. En ambos entra en `Intercambio P2P`.
3. Escribe nombres distintos, por ejemplo `MacBook` e `iPad`.
4. Pulsa `Activar intercambio cerca` en los dos.
5. Desde uno, invita al otro y verifica el mismo código en ambos.
6. El iniciador pulsa `Conectar ahora`.
7. Cuando aparezca `Canal P2P conectado`, pulsa `Sincronizar Biblioteca`.
8. Espera a que se combinen los cambios y comprueba Biblioteca en ambos dispositivos.

## Ficheros modificados

- `convex/schema.js`
- `convex/nearbyShare.js`
- `src/services/libraryJsonApi.js`
- `src/screens/playlist/P2PPlaylistExchangeScreen.js`
