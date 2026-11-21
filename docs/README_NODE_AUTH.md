# Shopp: autenticación alternativa con Node.js y JWT

Este paquete activa un **primer flujo independiente de Convex** para probar el backend Node:

- Convex continúa disponible como modo principal sin cambiar sus pantallas.
- Node tiene selector propio, pantallas propias de registro, verificación de correo, inicio de sesión y recuperación de contraseña.
- La sesión Node usa el JWT emitido por Express. Los modos Convex y Node no comparten sesiones ni crean cuentas espejo.
- Tras iniciar sesión se muestra una pantalla de confirmación Node. Las demás áreas de Shopp aún no están migradas y no aparecen en ese modo.

## Archivos del paquete

Copia los archivos manteniendo las rutas:

- `App.js`
- `.env.example`
- `src/api/config.js`
- `src/context/NodeAuthContext.js`
- `src/navigation/AuthStack.js`
- `src/navigation/NodeAppNavigator.js`
- `src/screens/auth/node/NodeAuthScreens.js`
- `src/screens/auth/node/NodeBackendHomeScreen.js`
- `shopp-node-postgres/.env.example`

No reemplaces los `.env` existentes: contienen la configuración privada y credenciales de tu instalación.

## Probar en el mismo Mac (web)

1. En `shopp-node-postgres/.env`, conserva la contraseña actual de PostgreSQL y completa las variables privadas de autenticación. Genera dos secretos diferentes de al menos 32 bytes aleatorios para `AUTH_CHALLENGE_SECRET` y `AUTH_JWT_SECRET`; configura además la clave y el remitente autorizados de Resend.
2. Arranca Express desde la carpeta del servidor:

   ```bash
   cd ~/Developer/shopp/shopp-node-postgres
   docker compose up -d --build
   curl -i http://localhost:3001/api/ready
   ```

   Comprueba que responde `ready` y `connected`.
3. En el `.env.local` raíz de la app, conserva Convex pero selecciona Node para esta prueba:

   ```env
   EXPO_PUBLIC_BACKEND_PROVIDER=node
   EXPO_PUBLIC_API_URL=http://localhost:3001
   ```

   No añadas estas variables a `shopp-node-postgres/.env`; son variables de la app cliente.
4. Desde la raíz de Shopp, reinicia Expo para que lea el cambio:

   ```bash
   cd ~/Developer/shopp
   npx expo start --web -c
   ```

5. Crea una cuenta, confirma el código de 8 dígitos recibido por correo e inicia sesión. El panel “Sesión Node activa” confirma que Express validó la sesión.

Para probar desde un teléfono, `localhost` debe cambiarse por la IP LAN del Mac, configurar esa URL en `EXPO_PUBLIC_API_URL` y permitir el origen de Expo en `CORS_ORIGINS`. Para acceso por Internet, usa un endpoint HTTPS estable y configura CORS para el dominio de la app.

## Volver al modo Convex

En `.env.local` establece:

```env
EXPO_PUBLIC_BACKEND_PROVIDER=convex
```

Mantén configuradas `EXPO_PUBLIC_CONVEX_URL` y las demás variables Convex que use tu app. Las cuentas y sesiones de ambos proveedores son independientes.

## Alcance y notas

- Las cuentas y contraseñas de Convex **no se importan** ni se vinculan automáticamente. Para probar el login Node, registra y verifica una cuenta en la base PostgreSQL.
- Listas, tiendas, escáner, chat, música y demás módulos no se migran con este paquete; siguen disponibles en el modo Convex.
- La sesión JWT se guarda en AsyncStorage para esta fase de integración. Antes de distribuir la app a usuarios, conviene cambiar el almacenamiento del token en dispositivos nativos a almacenamiento seguro del sistema.
- No compartas `.env`, secretos JWT, códigos OTP ni claves Resend. El archivo `.env.example` solo contiene marcadores.
