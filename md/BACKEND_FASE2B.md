# Shopp — Fase 2B: cliente HTTP y contrato de identidad

## Objetivo

Preparar llamadas HTTP reutilizables para el futuro proveedor Node.js, manteniendo
Convex como proveedor activo. Esta fase no migra operaciones ni habilita
`EXPO_PUBLIC_BACKEND_PROVIDER=node`.

## Cliente HTTP

- `src/api/httpClient.js` añade `createApiClient` y la instancia `apiClient`.
- Usa `EXPO_PUBLIC_API_URL` como origen, serializa cuerpos JSON y devuelve el
  cuerpo JSON o texto de la respuesta.
- Lanza `ApiError` con `status`, `code` y `details` ante errores HTTP o de red.
- Permite pasar un `accessToken` por petición, pero no almacena ni obtiene
  credenciales. La ruta queda restringida al origen configurado para evitar
  enviar accidentalmente un token a otro dominio.
- El módulo no cambia la selección actual de backend ni contiene aún llamadas
  de negocio.

Ejemplo de uso futuro:

```js
const result = await apiClient.request("api/v1/stores", {
  accessToken,
});
```

## Contrato de identidad que debe cumplir Express

Los campos de la cuenta actual de Shopp incluyen correo verificado, nombre,
rol (`user`, `tester`, `admin`), estado (`active`, `blocked`) y permisos por
función. La API debe conservarlos al migrar autenticación desde Convex Auth.

Reglas para el servidor:

1. Identificar la cuenta a partir de una credencial validada por Express; no
   aceptar `userId`, `role`, `isAdmin` ni `permissions` como autoridad cuando
   los envía el cliente.
2. Leer la cuenta y comprobar `status` en las operaciones protegidas. Un usuario
   bloqueado no debe seguir operando con una sesión antigua.
3. Autorizar cada ruta según el rol y el permiso funcional requerido. Ser
   administrador concede acceso administrativo; `tester` no debe equivaler a
   `admin`.
4. Mantener las sesiones de Convex válidas mientras Convex siga siendo el
   proveedor de autenticación. Node no debe interpretar ni reutilizar tokens de
   Convex sin una verificación criptográfica y una audiencia expresamente
   acordadas.
5. No guardar tokens en `EXPO_PUBLIC_*`. Antes de persistir credenciales en la
   aplicación debe decidirse un mecanismo apropiado para web y para dispositivos
   nativos.

## Decisiones pendientes antes de implementar el inicio de sesión Node

- Si las cuentas se migrarán conservando contraseñas o tendrán que establecer
  una contraseña nueva. No asumir compatibilidad de hashes de Convex Auth sin
  comprobar su formato y política.
- Cómo emitir, renovar y revocar sesiones; cómo aplicar bloqueo de cuenta y
  cambios de permisos a sesiones activas.
- Cómo conservar verificación y recuperación de correo con Resend.
- Qué almacenamiento seguro de sesión se utilizará en navegador y en Expo
  nativo.

## Siguiente entrega

Definir e implementar autenticación Node y autorización del servidor en una
entrega independiente. Después, trasladar el módulo Tiendas a PostgreSQL y
Express, conservar Convex para el resto y habilitar el adaptador Node solo para
las operaciones ya migradas.
