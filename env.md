El perfil Node apunta a http://localhost:3001, adecuado para usar Shopp en el navegador del mismo Mac. En Expo Go, localhost apunta al teléfono: necesitarás la IP local del Mac. Para producción, usa una URL HTTPS.
El código selecciona el backend con EXPO_PUBLIC_BACKEND_PROVIDER. Las variables EXPO_PUBLIC_BACKEND_MODE, EXPO_PUBLIC_BACKEND_AUTH_PROVIDER y EXPO_PUBLIC_BACKEND_STORES_PROVIDER aparecen en los archivos, pero el código de esta versión no las consulta; pueden confundir, aunque no cambian el backend seleccionado.
Los adjuntos .env de la app contienen variables privadas AUTH_* que no coinciden con las del servidor. El servidor usa las de shopp-node-postgres/.env; evita mantener copias distintas en la raíz de la app. Las variables privadas de Convex se configuran en el entorno de Convex.
Revisión de shopp-node-postgres
El .env del servidor tiene POSTGRES_DB=shopp, POSTGRES_USER=shopp_app y API_PORT=3001. El puerto coincide con la URL local de la app y con el mapeo de Docker.
Las claves JWT y OTP están presentes y tienen la longitud mínima que exige el código; el remitente de correo está configurado. No puedo confirmar desde el archivo que Resend haya verificado ese remitente.
CORS_ORIGINS incluye los dos orígenes locales habituales de Expo en el puerto 8081. Para producción habrá que añadir el origen HTTPS de la app.
El puente Convex↔Node requiere atención: el archivo del servidor contiene CONVEX_NODE_BRIDGE_SECRET, pero el docker-compose.yml de este ZIP no lo pasa al contenedor y server/src/config.js no lo carga, aunque la ruta interna intenta leerlo. El inicio de sesión Node directo no depende de ese puente; si queréis mantenerlo, habría que corregir esa configuración antes de usarlo.
Si PostgreSQL ya funciona con un volumen existente, conserva POSTGRES_PASSWORD: cambiarlo en el archivo no cambia automáticamente la contraseña guardada en la base.
Las plantillas .env.example llevan valores de ejemplo; no las uses como credenciales reales. Para mostrar Convex, utiliza el perfil con EXPO_PUBLIC_BACKEND_PROVIDER=convex; para probar el Node directo, el perfil con node y la URL local.

.env(3)
Documento
Puedes explicarme linea por linea las variables de entorno del fichero .env del proyecto Shopp?
El .env adjunto configura ahora Shopp para usar Node.js. Explico las líneas activas; oculto los valores de secretos y URLs.

Línea Variable Para qué sirve y qué significa aquí
2 CONVEX_DEPLOYMENT Indica a la CLI de Convex qué deployment usar. Lo utilizan comandos de desarrollo y despliegue de Convex; no selecciona el backend de la app.
3 EXPO_PUBLIC_CONVEX_URL URL pública que la app necesita para conectarse a Convex. No es una clave secreta. Convex no queda seleccionado mientras el proveedor sea node.
4 EXPO_PUBLIC_CONVEX_SITE_URL URL HTTPS del sitio HTTP de Convex. En el código de esta versión no encontré una lectura directa de esta variable; puede no tener efecto en la app.
5 EXPO_PUBLIC_ACCESS_MODE=landing Controla la pantalla de entrada al flujo de autenticación. En esta configuración, EXPO_PUBLIC_APP_MODE=development tiene prioridad y fuerza el modo de desarrollo.
6 EXPO_PUBLIC_APP_MODE=development Activa el flujo de desarrollo; por ejemplo, permite mostrar detalles técnicos en algunos errores de login y determina la pantalla inicial del flujo Node.
7 EXPO_PUBLIC_CONTACT_EMAIL Dirección que muestra la pantalla de contacto. Al llevar el prefijo EXPO_PUBLIC_, queda visible para los usuarios de la app.
8 EXPO_PUBLIC_BACKEND_PROVIDER=node Es la variable que selecciona Node.js. La app usa la autenticación y navegación Node. Para volver a Convex, cámbiala a convex.
10 EXPO_PUBLIC_API_URL Dirección base de Express. La URL local funciona desde el navegador del mismo Mac; para Expo Go en el teléfono se necesita la IP local del Mac y para producción, una URL HTTPS.
12 # EXPO_PUBLIC_BACKEND_PROVIDER=convex Está comentada, así que no tiene efecto. Es una referencia para cambiar el proveedor a Convex.
13–14 URLs comentadas Son referencias a túneles temporales de Cloudflare. Al estar comentadas no se usan; si se vuelve a usar un túnel, su dirección puede haber cambiado.
16 EXPO_PUBLIC_BACKEND_MODE=hybrid Parece indicar un modo híbrido, pero el código de esta versión no la consulta. El selector efectivo es la línea 8.
17 EXPO_PUBLIC_BACKEND_AUTH_PROVIDER=node El código actual tampoco la consulta: la autenticación la determina el proveedor principal de la línea 8.
18 EXPO_PUBLIC_BACKEND_STORES_PROVIDER=node No encontré que el código actual la consulte; no cambia por sí sola el backend de tiendas.
20 AUTH_RESEND_KEY Clave privada de Resend para enviar correos de verificación o recuperación. No debe estar en el .env de la app.
21 AUTH_EMAIL_FROM Remitente que utiliza el servidor para esos correos; debe estar autorizado en Resend. No necesita estar en el .env del frontend.
22 AUTH_CHALLENGE_SECRET Secreto del servidor para proteger los códigos temporales de autenticación.
23 AUTH_JWT_SECRET Secreto privado que usa el servidor Node para firmar tokens JWT.
Hay una contradicción: la primera línea del archivo indica que no se pongan claves privadas aquí, pero las líneas 20–23 contienen variables privadas. Para Node, deben estar en shopp-node-postgres/.env; las que necesite Convex deben configurarse en el entorno de Convex. No las copies al frontend ni las incluyas en un ZIP compartido.

Para ver las pantallas actuales de Convex, cambia temporalmente la línea 8 a:

EXPO_PUBLIC_BACKEND_PROVIDER=convex
Luego reinicia Expo con npx expo start --web -c. No he modificado el fichero.
