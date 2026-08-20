# Shopp

Documentación técnica adicional:

- [Arquitectura](docs/ARCHITECTURE.md)
- [Auditoría de limpieza](docs/CLEANUP_AUDIT.md)

Shopp es una aplicación de listas de compra desarrollada con Expo, React Native y React Native Web. El mismo proyecto puede ejecutarse en iOS, Android y navegador, y la versión web puede instalarse como una PWA en el teléfono.

La aplicación permite organizar compras, consultar productos y tiendas, escanear códigos de barras, compartir información mediante chat y utilizar funciones de aparcamiento asociadas a la ubicación.

## Características principales

### Listas de compra

- Crear, cambiar el nombre y eliminar listas.
- Añadir productos indicando nombre, cantidad, unidad y precio.
- Marcar productos como incluidos o comprados.
- Asociar una lista con una tienda.
- Calcular el importe total y el ahorro de promociones.
- Aplicar promociones como 2x1, 3x2, porcentajes o descuentos.
- Archivar listas terminadas.
- Consultar el historial de compras y el detalle de cada compra.

Los datos de la interfaz de listas se gestionan mediante `ListsContext`. Las operaciones que necesitan sincronización entre usuarios o dispositivos se realizan mediante Convex.

### Tiendas

La sección **Tiendas** permite:

- Consultar el listado de establecimientos.
- Buscar y seleccionar una tienda para una lista.
- Guardar tiendas favoritas.
- Consultar la información y la ubicación de una tienda.
- Ver tiendas cercanas utilizando la ubicación del dispositivo.
- Mostrar tiendas en un mapa cuando la plataforma lo permite.

La ubicación se solicita únicamente cuando una función la necesita, por ejemplo para mostrar tiendas cercanas o gestionar el aparcamiento.

### Escáner de códigos de barras

La sección **Scanner** permite leer códigos EAN con la cámara del dispositivo.

Sus funciones incluyen:

- Escanear un código de barras desde iOS o Android.
- Utilizar el escáner web cuando el navegador ofrece acceso a la cámara.
- Consultar información de un producto.
- Añadir el producto a una lista.
- Editar los datos detectados antes de guardarlos.
- Consultar el historial de códigos escaneados.
- Configurar el comportamiento del escáner y el zoom disponible.

En la versión web es necesario conceder permiso de cámara al navegador. En iOS y Android el permiso se solicita la primera vez que se utiliza el escáner.

### Productos y caché

Shopp puede consultar información de productos a partir de su código de barras. Para reducir consultas repetidas, utiliza una caché local y una caché de productos en Convex cuando corresponde.

El usuario puede configurar desde su perfil si desea sincronizar su historial de productos escaneados. La caché local permite reutilizar información ya consultada y mejora el funcionamiento cuando la conexión es limitada.

### Chat

La sección **Chat** proporciona comunicación entre usuarios autenticados. El sistema utiliza Convex para guardar y distribuir los mensajes en tiempo real.

El perfil puede incluir un alias visible para otros usuarios. De este modo, el chat y las funciones de aparcamiento no tienen que mostrar necesariamente la dirección de correo electrónico.

El chat incluye controles de seguridad para los enlaces y tareas de mantenimiento que eliminan mensajes antiguos según la configuración del backend.

### Aparcamiento

La función **Parking** permite comunicar el estado de aparcamiento a otros usuarios autorizados.

Incluye, según la configuración del proyecto:

- Indicar que se está buscando aparcamiento.
- Indicar que se ha aparcado o que se está abandonando una plaza.
- Compartir mensajes y observaciones relacionados con una zona.
- Utilizar destinos y zonas de aparcamiento almacenados en Convex.
- Usar la ubicación y mapas en las plataformas compatibles.

La aplicación debe tener permiso de ubicación para utilizar las funciones que dependen del GPS. Las herramientas de depuración GPS son funciones administrativas y no forman parte del uso normal.

### Cuenta y perfil

La aplicación requiere una cuenta para acceder a la zona principal. Desde el perfil se pueden gestionar:

- Datos básicos del usuario.
- Alias visible.
- Teléfono y preferencias de visibilidad.
- Preferencias de sincronización del historial escaneado.
- Cierre de sesión.

También están disponibles el registro, el inicio de sesión y la recuperación de contraseña mediante código enviado por correo electrónico.

### Administración

Los usuarios con permisos de administrador disponen de pantallas adicionales para tareas como:

- Gestionar usuarios.
- Revisar aportaciones o revisiones de productos.
- Supervisar datos de tiendas y aparcamiento.
- Ejecutar herramientas de diagnóstico y mantenimiento.

Estas funciones deben protegerse en el backend mediante comprobaciones de rol; ocultar una pantalla en la navegación no constituye una medida de seguridad suficiente.

## Convex

Convex es el backend de Shopp. Proporciona base de datos, autenticación, consultas reactivas, mutaciones y funciones del servidor.

La aplicación crea el cliente Convex en `App.js` y lo proporciona a toda la navegación mediante `ConvexAuthProvider`. `AppNavigator` muestra el flujo de autenticación cuando no hay una sesión válida y las pestañas principales cuando el usuario está autenticado.

### Qué gestiona Convex

El esquema de `convex/schema.js` contiene, entre otros, datos de:

- Usuarios y perfiles.
- Productos y caché de productos.
- Historial de códigos de barras y escaneos.
- Tiendas y tiendas favoritas.
- Mensajes de chat.
- Presencia, mensajes, destinos y plazas de aparcamiento.
- Revisiones o aportaciones de productos.
- Adjuntos de informes de derechos.

Las funciones del backend están en la carpeta `convex/`. Las consultas (`query`) leen datos, las mutaciones (`mutation`) los modifican y las acciones (`action`) se utilizan cuando es necesario realizar trabajo externo o más complejo.

Las consultas de Convex son reactivas: cuando cambia un dato que utiliza una pantalla, Convex puede actualizar esa pantalla automáticamente sin que el usuario tenga que recargarla.

### Autenticación

La autenticación se integra con `@convex-dev/auth`. El flujo general es:

1. El usuario crea una cuenta o inicia sesión.
2. Convex valida la sesión y mantiene el token de autenticación.
3. Las consultas y mutaciones reciben el usuario autenticado.
4. El backend comprueba la identidad y, cuando corresponde, el rol de administrador.

No se debe confiar en datos enviados por el cliente para autorizar operaciones. Las comprobaciones de propiedad y permisos deben permanecer en las funciones de `convex/`.

## Requisitos

- Node.js compatible con la versión indicada en `netlify.toml`.
- npm.
- Expo CLI incluido mediante el proyecto.
- Una implementación de Convex.
- Para el escáner nativo: un dispositivo iOS o Android con cámara.

## Instalación local

Desde la carpeta raíz del proyecto:

```bash
npm install
```

Crea un archivo `.env.local` a partir de `.env.example` y define la URL pública de Convex:

```env
EXPO_PUBLIC_CONVEX_URL=https://tu-deployment.convex.cloud
```

La URL se obtiene al ejecutar o vincular el proyecto con Convex. No publiques claves secretas en `.env.local`, en el repositorio ni en el código de la aplicación.

Para iniciar el backend de desarrollo:

```bash
npx convex dev
```

En otra terminal, inicia Expo:

```bash
npm start
```

Comandos útiles:

```bash
npm run web          # Ejecutar la versión web
npm run start:clean  # Iniciar Expo limpiando la caché
npm run build        # Generar la exportación web en dist/
npm run android      # Ejecutar en Android
npm run ios          # Ejecutar en iOS
```

## Publicación web

La configuración de Netlify utiliza:

- Comando de compilación: `npx expo export -p web`.
- Carpeta publicada: `dist`.
- Redirección de rutas hacia `index.html` para React Navigation.
- `public/manifest.webmanifest` para la instalación como PWA.
- `public/sw.js` para la caché básica del shell de la aplicación y el funcionamiento offline limitado.

Después de publicar la aplicación, comprueba que la URL de Convex está configurada en las variables de entorno del entorno de despliegue. Si falta `EXPO_PUBLIC_CONVEX_URL`, la aplicación no podrá crear correctamente el cliente Convex.

## Instalar Shopp como PWA en el móvil

La instalación se realiza desde la versión web publicada. Es necesario abrir la aplicación mediante HTTPS y utilizar un navegador compatible.

### iPhone o iPad

1. Abre la URL pública de Shopp en Safari.
2. Pulsa el botón **Compartir**.
3. Selecciona **Añadir a pantalla de inicio**.
4. Cambia el nombre si lo deseas y pulsa **Añadir**.
5. Abre Shopp desde el nuevo icono.

La aplicación se abrirá en modo independiente, parecido a una aplicación instalada. Safari puede limitar algunas funciones en segundo plano y el acceso a la cámara siempre requiere autorización.

### Android

1. Abre la URL pública de Shopp en Chrome.
2. Abre el menú de los tres puntos.
3. Selecciona **Instalar aplicación** o **Añadir a pantalla de inicio**.
4. Confirma la instalación.
5. Abre Shopp desde el icono creado.

El texto exacto puede variar según la versión de Chrome y el fabricante del teléfono. Si no aparece la opción de instalación, comprueba que la página se sirve mediante HTTPS y que el navegador ha cargado correctamente el manifiesto de la aplicación.

### Limitaciones de la PWA

- La cámara depende del soporte del navegador y de los permisos concedidos.
- La geolocalización necesita permiso y puede ser menos precisa en interiores.
- El service worker mantiene en caché la aplicación y algunos recursos, pero no convierte automáticamente todos los datos de Convex en datos offline.
- Las consultas que requieren conexión a Convex no estarán disponibles mientras el dispositivo permanezca sin red.
- Para recibir actualizaciones, puede ser necesario cerrar y volver a abrir la PWA después de una publicación.

## Estructura del proyecto

```text
App.js                 Entrada de la aplicación y proveedor Convex
src/navigation/        Navegación y pestañas
src/screens/           Pantallas de autenticación y funcionalidades
src/context/           Estado compartido de listas, tiendas y ubicación
src/services/          Servicios auxiliares y consultas externas
src/utils/             Utilidades, precios, cachés y validaciones
convex/                Esquema y funciones del backend
public/                Manifiesto PWA, service worker y redirecciones
assets/                Iconos, imágenes y recursos estáticos
```

## Seguridad y mantenimiento

- Mantén las variables secretas únicamente en la configuración del backend o del proveedor de despliegue.
- Revisa los permisos de cámara y ubicación antes de probar las funciones correspondientes.
- Comprueba las reglas de autorización de cada query y mutation de Convex.
- No borres datos de producción desde scripts de desarrollo sin verificar antes el deployment seleccionado.
- Antes de publicar, ejecuta `npm run build` y prueba el inicio de sesión, la carga de listas, el escáner, el chat y el mapa.

## Licencia

El proyecto declara licencia MIT en `package.json`, salvo que el propietario del repositorio establezca condiciones adicionales para determinados recursos o contenidos.
