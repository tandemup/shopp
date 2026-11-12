# Shopp — Fase 2C-A: autenticación y autorización Node

## Alcance de esta entrega

- Express incorpora registro, verificación por código OTP, login, consulta de
  sesión, cierre de sesión y recuperación de contraseña.
- Las contraseñas usan scrypt; los tokens de sesión son aleatorios y PostgreSQL
  conserva solo su SHA-256. Las sesiones pueden revocarse y caducan según
  `SESSION_TTL_HOURS`.
- El middleware vuelve a consultar usuario, estado, rol y permisos en cada
  petición autenticada. Las rutas futuras pueden usar `requireAuth`,
  `requireAdmin` o `requireFeature('stores')`.
- Se aplica CORS por lista de orígenes y un límite en memoria para las rutas
  públicas de autenticación, válido para la instancia única inicial.
- El servidor aplica migraciones SQL versionadas al arrancar y envía los códigos
  de verificación y recuperación con Resend.
- Convex sigue activo; el cliente todavía no selecciona ni consume este login.

## Esquema de identidad

`app_users` conserva un `convex_user_id` opcional para enlazar cuentas durante
una futura importación. El rol (`user`, `tester`, `admin`), estado (`active`,
`blocked`) y objeto `permissions` son autoridad del servidor. No se admiten
estos valores como datos de autorización enviados por el cliente.

La migración no importa cuentas ni contraseñas. `password_hash` es nullable para
permitir importar cuentas que tendrán que establecer una contraseña Node. Las
cuentas nuevas se registran por correo y verifican un código OTP de 8 dígitos.
La contraseña sigue la política actual de Shopp: al menos 8 caracteres, con
mayúscula, minúscula y número. Los OTP caducan a los 15 minutos, se limitan a
cinco intentos y se almacena un HMAC, nunca el código en claro.

No se aceptan tokens de Convex. Antes de mover usuarios existentes hay que
decidir cómo restablecer contraseñas sin asumir que los hashes internos de
Convex Auth son compatibles.

## Configuración

- `SESSION_TTL_HOURS`: duración de la sesión, entero entre 1 y 720; por defecto,
  168 horas.
- `CORS_ORIGINS`: lista separada por comas de los orígenes web permitidos.
- `AUTH_RESEND_KEY`: clave privada de Resend.
- `AUTH_EMAIL_FROM`: remitente verificado para mensajes de Shopp.
- `AUTH_CHALLENGE_SECRET`: secreto privado de al menos 32 caracteres que protege
  los códigos OTP almacenados; un valor vacío desactiva registro/verificación y
  recuperación.
- Genera `AUTH_CHALLENGE_SECRET` localmente con `openssl rand -base64 48` y no
  lo compartas ni lo incluyas en el frontend.
- `TRUST_PROXY=true`: usar solo si la aplicación está detrás de un proxy inverso
  controlado que reescribe `X-Forwarded-For`.
- El limitador de login reside en memoria; antes de ejecutar varias instancias o
  reiniciar frecuentemente, sustituirlo por un almacén compartido y configurar
  además el límite del proxy inverso.

## Pendiente antes de usarlo con usuarios reales

1. Definir importación de cuentas Convex, IDs y cambio/restablecimiento de clave.
2. Migrar perfiles, invitaciones y activación de testers.
3. Añadir provisión segura de la primera cuenta administrador.
4. Decidir almacenamiento del token en web y en Expo nativo; no persistirlo en
   variables `EXPO_PUBLIC_*`.
5. Migrar las operaciones de Tiendas y conectar su proveedor Node. No habilitar
   globalmente `EXPO_PUBLIC_BACKEND_PROVIDER=node` con esta entrega.

## Rutas

| Método | Ruta | Acceso | Resultado |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Público, limitado por IP | Crea cuenta pendiente y envía OTP; respuesta genérica. |
| `POST` | `/api/v1/auth/verify-email` | Público, limitado por IP | Verifica OTP y crea sesión. |
| `POST` | `/api/v1/auth/request-password-reset` | Público, limitado por IP | Solicita código; respuesta genérica para evitar enumeración. |
| `POST` | `/api/v1/auth/reset-password` | Público, limitado por IP | Consume OTP, cambia contraseña y revoca sesiones. |
| `POST` | `/api/v1/auth/login` | Público, limitado por IP | Crea sesión para cuenta activa, verificada y con clave scrypt. |
| `GET` | `/api/v1/auth/me` | Bearer | Devuelve identidad y permisos actuales. |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoca la sesión actual. |
