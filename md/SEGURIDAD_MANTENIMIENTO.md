# Seguridad, pruebas y mantenimiento

> **Estado documental:** consolidación del ZIP `md(1).zip` (29-10-2026). La documentación técnica base fue elaborada en revisiones anteriores (principalmente septiembre de 2026); **no implica una auditoría del código vigente**. Revisar rutas, versiones y comportamiento contra el repositorio antes de aplicar cambios.

## Seguridad y privacidad

## 1. Frontera de confianza

La regla principal del proyecto debe ser:

> El cliente no es una frontera de seguridad.

Todo código React Native/Web puede ser inspeccionado o manipulado por el usuario. Por ello:

- ocultar un botón de admin no autoriza una operación;
- validar `isAdmin` solo en UI no es suficiente;
- IDs de usuario enviados por cliente no deben aceptarse como prueba de identidad;
- secretos no deben incluirse en el bundle.

## 2. Autenticación y roles

Convex Auth gestiona la identidad.

`convex/lib/auth.js` proporciona:

- `requireUser(ctx)`;
- `requireAdmin(ctx)`.

`requireAdmin` acepta el rol `admin` (y contempla compatibilidad con `isAdmin === true`).

Las funciones sensibles de dominios como usuarios, live, revisiones y shopping import llaman a comprobaciones administrativas.

Al crear nuevas funciones Convex, reutilizar estos patrones en vez de confiar en la navegación del frontend.

## 3. Secretos

### Variables seguras de backend

Ejemplos:

- `AUTH_RESEND_KEY`
- `OPENAI_API_KEY`
- otros tokens de servicios externos ejecutados exclusivamente server-side.

Deben residir en el entorno de Convex/proveedor backend.

### Variables públicas

Cualquier `EXPO_PUBLIC_*` es visible para el cliente.

Esto es correcto para:

- URL pública de Convex;
- versión de app;
- nombre de sitio;
- URLs públicas sin capacidad privilegiada.

No es correcto para claves permanentes con capacidad de facturación/escritura.

## 4. TURN en Fire Alarm

La implementación admite:

```text
EXPO_PUBLIC_FIREALARM_TURN_URL
EXPO_PUBLIC_FIREALARM_TURN_USERNAME
EXPO_PUBLIC_FIREALARM_TURN_CREDENTIAL
```

El propio repositorio advierte correctamente que estas variables quedan visibles en navegador.

Para producción:

- no usar una contraseña TURN estática de larga duración;
- preferir credenciales temporales/efímeras;
- emitirlas desde un backend autenticado;
- limitar TTL y, si el proveedor lo permite, scope/uso.

## 5. Shopp Live y NAT traversal

Shopp Live usa actualmente solo STUN público en `LiveCameraWeb.js`.

Consecuencia:

- funcionará en muchos casos P2P;
- puede fallar en NAT simétrico, redes corporativas, CGNAT o firewalls restrictivos;
- para fiabilidad de producción se necesita una estrategia TURN.

Si se añade TURN, aplicar el mismo principio de credenciales temporales.

## 6. Permisos de navegador

Cámara, micrófono y ubicación requieren HTTPS fuera de `localhost` y consentimiento del usuario.

El header `Permissions-Policy` puede bloquear una capacidad antes incluso de que se muestre el prompt del navegador.

En el estado actual de `netlify.toml`:

- cámara: permitida a `self`;
- micrófono: bloqueado.

Esto es incompatible con el audio de Shopp Live.

## 7. Datos de geolocalización

Parking almacena coordenadas, precisión y estados de presencia/plaza.

Recomendaciones:

- limitar retención de presencia efímera;
- evitar conservar coordenadas históricas sin necesidad de producto;
- proteger queries por contexto de usuario/rol;
- documentar al usuario cuándo y con qué finalidad se comparte ubicación;
- no usar datos de debug GPS como sustituto silencioso de preferencias de usuario.

## 8. Imágenes y ficheros

El proyecto usa almacenamiento local y Convex Storage.

Casos con expiración explícita:

- imágenes temporales de producto;
- adjuntos temporales de comunicaciones a administración.

Los crons limpian ambos dominios.

Para cualquier nueva subida:

1. validar autenticación;
2. limitar tamaño y MIME;
3. evitar aceptar nombres de fichero como ruta confiable;
4. borrar ficheros huérfanos;
5. definir TTL cuando el recurso sea temporal.

## 9. URLs y contenido externo

`chatMessages` puede guardar información de análisis de URLs y estados como:

- trusted;
- safe;
- pending;
- suspicious;
- malicious;
- blocked;
- unknown.

La Biblioteca normaliza URLs y elimina determinados parámetros de tracking locales.

Al enriquecer enlaces desde servidor, protegerse frente a SSRF:

- permitir únicamente `http/https`;
- bloquear loopback/redes privadas/metadata endpoints;
- limitar redirects;
- aplicar timeout y límite de tamaño;
- no descargar contenido arbitrario sin validación.

## 10. Exportaciones y backups

Los JSON y ZIP pueden contener información personal/local del usuario.

El backup ZIP implementa CRC y hashes de contenido, lo cual ayuda a detectar corrupción, pero **no cifra** el backup.

Si se almacenan copias en servicios externos, tratarlas como datos potencialmente sensibles.

## 11. Denegación de servicio y costes

Convex es reactivo: una query mal dimensionada o una mutación repetida desde bots puede incrementar consumo.

Medidas recomendadas:

- paginación;
- límites de tamaño;
- índices adecuados;
- throttling/rate limiting en acciones críticas;
- evitar búsquedas remotas por cada pulsación de teclado;
- deduplicación por URL/barcode/fingerprint;
- trabajos por lotes para importaciones masivas;
- límites por usuario para upload y WebRTC signaling.

La Biblioteca ya adopta varias de estas técnicas: paginación, lotes, fingerprints, límites y trabajos reanudables.


---

## Pruebas, mantenimiento y deuda técnica

## 1. Suite de tests presente

El repositorio contiene pruebas Node en `tests/`:

- `dialog-behavior.test.mjs`
- `scanned-product-flow.test.mjs`
- `zip-store.test.mjs`
- helper `test-loader.mjs`

Ejecución utilizada durante esta revisión:

```bash
node --test tests/*.test.mjs
```

## 2. Resultado observado el 2026-09-04

```text
4 tests
2 passed
2 failed
```

### Pasan

- creación/lectura de ZIP almacenado;
- detección de corrupción mediante CRC.

### Falla: dialog-behavior

Error:

```text
Cannot use import statement outside a module
```

Causa probable: `safeAlert.js` incorporó un nuevo import (`tr` desde `@/src/i18n`) que el loader ad-hoc del test no sustituye. El test harness necesita actualizarse para manejar ese import o migrarse a un runner/transpilador más estándar.

### Falla: scanned-product-flow

El test espera que `product_type: "food"` produzca:

```text
Supermercado
```

pero el código actual normaliza `food` a:

```text
Alimentos
```

Por tanto, el fallo parece ser principalmente una **desalineación entre especificación del test y taxonomía actual**, no necesariamente un fallo del código. Debe decidirse cuál es el comportamiento canónico y actualizar test o implementación.

## 3. Falta un script npm `test`

`package.json` no define actualmente `test`.

Recomendación:

```json
{
  "scripts": {
    "test": "node --test tests/*.test.mjs"
  }
}
```

Una vez corregidos los tests, incorporar este comando a CI.

## 4. Cobertura prioritaria que falta

### Autenticación y autorización

- usuario no autenticado no puede mutar datos privados;
- user no puede invocar operaciones admin;
- admin sí puede realizar las operaciones esperadas;
- propietario no puede modificar datos de otro propietario salvo regla explícita.

### Biblioteca

- import combine sin duplicar URL;
- replace elimina únicamente el scope previsto;
- reanudación de import job;
- cancelación/interrupción;
- 477+ fuentes sin truncado lógico;
- búsqueda paginada;
- normalización de carpetas;
- integridad newsArticle ↔ newsSource.

### Scanner

- Alimentos/Supermercado/Libros/Música;
- round-trip local ↔ Convex;
- migración legacy;
- edición y cancelación;
- imágenes temporales;
- caché y revisión administrativa.

### WebRTC

- creación/cierre de sesión;
- máximo de viewers;
- limpieza de ICE;
- `RTCDataChannel`;
- fallback cuando no existe `getUserMedia`;
- STUN-only vs TURN;
- permisos bloqueados por navegador/header.

### Backup

- merge;
- replace;
- hashes inválidos;
- media ausente;
- versiones incompatibles;
- backup grande.

## 5. Deuda técnica observada

### 5.1 Dos pantallas `LibraryScreen`

Existen:

- `src/screens/library/LibraryScreen.js`
- `src/screens/chat/LibraryScreen.js`

La ruta activa del `ShoppingStack` usa la primera. La segunda puede ser legacy o tener otro propósito. Conviene renombrar/eliminar para reducir ambigüedad.

### 5.2 Configuración socket legacy

`config/env.js` y `.env.example` conservan `EXPO_PUBLIC_SOCKET_URL` y comentarios de Heroku/socket.io, mientras la arquitectura principal usa Convex.

Si ya no existe runtime dependiente del socket, eliminarlo para evitar configuración fantasma.

### 5.3 Varias tablas de historial/producto

Existen simultáneamente `products`, `productCache`, `scanHistory`, `userScanHistory`, `barcodeScans`, `productContributions` y `productReviewSubmissions`.

No es incorrecto, pero sí requiere documentación de ownership y lifecycle para evitar escribir el mismo concepto en varias tablas de manera divergente.

### 5.4 Taxonomía de producto en transición

El repositorio maneja tanto `Alimentos` como `Supermercado`. Tests antiguos aún asumen mappings previos. Se necesita una definición de dominio única y tests de compatibilidad legacy.

### 5.5 Netlify bloquea micrófono

`netlify.toml` usa `microphone=()`, pero Shopp Live pide audio. Esto explica posibles `Permission denied` o ausencia de audio en producción web.

### 5.6 Shopp Live sin TURN

La implementación de cámara utiliza solo STUN. No puede garantizar conectividad WebRTC en todas las redes.

### 5.7 Credenciales TURN públicas en Fire Alarm

La fase actual usa variables `EXPO_PUBLIC_*`. Es aceptable solo si son credenciales temporales. No usar credenciales TURN permanentes.

### 5.8 Código histórico dentro del árbol

Hay carpetas como `work/` y documentación/ficheros legacy. Separar snapshots históricos del árbol activo simplificaría búsquedas, auditoría y empaquetado.

## 6. Mantenimiento periódico

### Semanal

- comprobar errores de Convex/Netlify;
- revisar jobs de importación interrumpidos;
- comprobar que crons de limpieza funcionan;
- ejecutar tests y build web.

### Antes de release

- actualizar lockfile de forma controlada;
- validar schema Convex;
- probar migraciones;
- probar permisos en Chrome/Safari móvil;
- probar PWA instalada, no solo pestaña del navegador;
- probar datos existentes de producción/preview con backup.

### Tras cambios de schema

- mantener campos opcionales durante migraciones cuando haya documentos antiguos;
- crear índices antes de depender de consultas nuevas;
- migrar por lotes;
- no borrar campos legacy hasta verificar que ninguna versión desplegada los consume.

## 7. Definición de “done” recomendada

Un cambio de funcionalidad se considera terminado cuando:

- UI funciona en su plataforma objetivo;
- persistencia funciona tras cerrar/reabrir;
- autorización backend está verificada;
- no introduce consultas no paginadas sobre colecciones grandes;
- tests relevantes pasan;
- `npm run build` pasa;
- no añade secretos a `EXPO_PUBLIC_*`;
- la documentación de este conjunto se actualiza si cambia arquitectura o modelo de datos.


---

## Guía de mantenimiento resumida

### Mantenimiento (síntesis anterior)

## Administradores

Para activar el primer administrador, despliega las funciones, abre la tabla `users` en Convex, localiza el usuario y asigna `role: "admin"`. Después, cierra y vuelve a iniciar sesión si el menú no se actualiza. Los cambios posteriores pueden hacerse desde la pantalla de administración de usuarios.

La interfaz solo controla la visibilidad; la protección real debe permanecer en las consultas y mutaciones del backend.

## Diálogos

Los mensajes, confirmaciones y menús deben pasar por la API común `safeAlert`, `safeConfirm` y `safeMenu`, alojada en `components/ui/alert/`. `DialogHost` debe estar montado desde `App.js`.

Evita introducir llamadas directas a `Alert.alert`, `window.alert`, `window.confirm` o `window.prompt` fuera del módulo de respaldo. Así se mantiene un aspecto coherente en PWA, iOS y Android.

## Limpieza segura

Antes de retirar código heredado:

1. Buscar importaciones y rutas con `rg`.
2. Eliminar su acceso desde la navegación.
3. Probar Web, iOS y Android.
4. Actualizar `package.json`, el lockfile y esta documentación.

Las pantallas de diagnóstico o pruebas no deben presentarse como funciones normales. Conviene revisar especialmente las relacionadas con Carrefour, GPS de parking y aprendizaje de productos.

## Documentación histórica

Estos temas pueden conservarse fuera de la documentación principal, pero no deben usarse como instrucciones vigentes:

- servidor `shopp-server`, Heroku, PostgreSQL y Socket.IO;
- álbumes, reproductor musical y Google Drive;
- propuestas iniciales de parking ya sustituidas por la implementación actual;
- volcados completos de archivos usados para aplicar migraciones;
- tutoriales generales de Git, GitHub CLI y configuración de `origin`.

Si todavía resultan útiles, guárdalos en una carpeta `docs/archive/` con una advertencia visible de contenido histórico.

## Alcance de esta síntesis

Esta documentación se ha condensado a partir de los documentos entregados. Cuando cambie el código, el repositorio debe considerarse la fuente definitiva y estos tres archivos deben actualizarse junto con él.

## Limpieza documental y de archivos

### Auditoría histórica de limpieza

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

## Pruebas de betatesters

### Invitaciones para betatesters

En **Administración > Usuarios**, introduce el email y pulsa **Crear invitación**.
La invitación caduca en 7 días. Comparte manualmente la URL de Shopp: el sistema no envía correos de invitación automáticamente.
El tester debe registrarse desde **Registro tester** en la pantalla En desarrollo, emplear exactamente el correo autorizado y verificarlo con el código de Convex Auth.
Después de verificar, el servidor comprueba la invitación, asigna el rol tester y los permisos iniciales.
Para usuarios ya registrados, cambia el rol desde Administración > Usuarios (Usuario → Tester → Admin → Usuario) y aplica **Acceso inicial** en Utilidades.

Despliega las funciones y el esquema con `npx convex dev` en desarrollo o `npx convex deploy` en producción, según tu flujo de despliegue. No se ha modificado la configuración de Netlify.
