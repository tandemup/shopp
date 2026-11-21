# Migración Node: perfil y seguridad de cuenta

## Incluido

El modo Node ofrece una pantalla «Mi cuenta» independiente del perfil Convex. El usuario autenticado puede consultar su correo verificado y rol, actualizar su nombre y alias público, cambiar la contraseña mediante un código y cambiar el correo enviando un código a la nueva dirección. El alias público se usa como nombre inicial del chat Node. El servidor determina la identidad mediante el JWT para editar el perfil y verifica los códigos antes de actualizar la contraseña o el correo.

## Ruta

`PATCH /api/v1/auth/me` recibe `{ "name": "Nombre nuevo", "alias": "Alias público" }`. El nombre se recorta y debe contener entre 1 y 120 caracteres; el alias debe tener entre 2 y 40. El endpoint devuelve el perfil actualizado. El cliente no puede editar su propio correo, rol, permisos ni estado.

El cambio de correo usa `POST /api/v1/auth/me/email-change/request` y `POST /api/v1/auth/me/email-change/confirm`. El reto OTP se vincula al usuario y a la dirección destino y caduca a los 15 minutos. La confirmación marca el correo como verificado y revoca las sesiones activas; el usuario debe iniciar sesión otra vez con la dirección nueva.

## Archivos principales

- `src/screens/auth/node/NodeProfileScreen.js`: pantalla de consulta y edición del nombre y alias.
- `src/screens/auth/node/NodeAuthScreens.js`: reutiliza el flujo de código por email para cambiar la contraseña.
- `src/screens/auth/node/NodeEmailChangeScreen.js`: solicitud y confirmación del nuevo correo.
- `src/navigation/NodeAppNavigator.js`: acceso al perfil dentro de la sesión Node.
- `src/context/NodeAuthContext.js`: mantiene actualizado el perfil de la sesión después del cambio.
- `src/api/providers/node/auth.js`: llamada REST autenticada.
- `shopp-node-postgres/server/src/routes/auth.js`: ruta protegida de actualización.
- `shopp-node-postgres/server/migrations/012_email_change_challenges.sql`: permite retos `change_email` y guarda su dirección destino.
- `shopp-node-postgres/server/migrations/013_public_alias.sql`: guarda un alias público independiente del nombre de la cuenta.
- `POST /api/v1/auth/request-password-reset` y `POST /api/v1/auth/reset-password`: solicitan y validan el código de cambio. Al actualizar la contraseña, el servidor revoca las sesiones existentes y la app vuelve al login Node.

## Lo que queda para una fase posterior

- Preferencias de privacidad de teléfono y sincronización del historial de escaneos.
- Avatar y almacenamiento de imágenes.
- Migración de las funciones de perfil que se mantienen en Convex.

No se migran usuarios ni datos de Convex. Cada usuario Node mantiene una cuenta independiente.
