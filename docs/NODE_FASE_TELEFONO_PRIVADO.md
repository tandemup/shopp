# Fase Node: teléfono de contacto privado

La pantalla «Mi cuenta» permite guardar, modificar o borrar un teléfono en el perfil de la cuenta Node. Express devuelve ese dato únicamente en las respuestas autenticadas de la propia cuenta (`/api/v1/auth/me`, login, refresh y actualización del perfil). La función `publicUser`, usada por el chat y otras respuestas públicas, no incluye el teléfono.

Al borrar el número, también se desactiva cualquier marca de visibilidad que pudiera existir en el perfil. Node no publica el teléfono en el chat ni en listados de usuarios. La opción `phone_visible` permanece desactivada hasta que se migre un módulo que necesite mostrar datos de contacto y se defina explícitamente quién puede verlos.

El teléfono se guarda en la tabla `user_profiles` ya existente; no se añade una nueva migración ni se importa el perfil de Convex. Las cuentas nuevas completan este campo desde «Mi cuenta» cuando lo desean.
