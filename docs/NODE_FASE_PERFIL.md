# Migración Node: perfil y seguridad de cuenta

## Incluido

El modo Node ofrece una pantalla «Mi cuenta» independiente del perfil Convex. El usuario autenticado puede consultar su correo verificado y rol, actualizar el nombre visible y abrir el flujo de recuperación para cambiar su contraseña mediante un código de correo. El servidor determina la identidad mediante el JWT para editar el nombre y verifica el código para cambiar la contraseña.

## Ruta

`PATCH /api/v1/auth/me` recibe `{ "name": "Nombre nuevo" }`. El nombre se recorta y debe contener entre 1 y 120 caracteres. El endpoint devuelve el perfil actualizado. El cliente no puede editar su propio correo, rol, permisos ni estado.

## Archivos principales

- `src/screens/auth/node/NodeProfileScreen.js`: pantalla de consulta y edición del nombre.
- `src/screens/auth/node/NodeAuthScreens.js`: reutiliza el flujo de código por email para cambiar la contraseña.
- `src/navigation/NodeAppNavigator.js`: acceso al perfil dentro de la sesión Node.
- `src/context/NodeAuthContext.js`: mantiene actualizado el perfil de la sesión después del cambio.
- `src/api/providers/node/auth.js`: llamada REST autenticada.
- `shopp-node-postgres/server/src/routes/auth.js`: ruta protegida de actualización.
- `POST /api/v1/auth/request-password-reset` y `POST /api/v1/auth/reset-password`: solicitan y validan el código de cambio. Al actualizar la contraseña, el servidor revoca las sesiones existentes y la app vuelve al login Node.

## Lo que queda para una fase posterior

- Preferencias personales y configuración del idioma.
- Avatar y almacenamiento de imágenes.
- Cambio de dirección de correo con verificación.
- Migración de las funciones de perfil que se mantienen en Convex.

No se migran usuarios ni datos de Convex. Cada usuario Node mantiene una cuenta independiente.
