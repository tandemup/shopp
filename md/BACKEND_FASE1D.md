# Fase 1D — Contrato de autenticación y sesión

## Alcance

- Nuevo `useShoppAuthActions` para login, registro, reset y logout.
- Nuevo `useShoppAuthSession` para navegación.
- `ShoppAuthBoundary` centraliza los tres estados de autenticación.
- `auth.js` define roles, bloqueo y permisos de acceso visuales.
- Se preserva `@convex-dev/auth` y el contrato de `signIn("password", ...)`.
- No se cambian credenciales, almacenamiento de tokens, rutas ni esquema de DB.

**Importante:** los permisos del cliente son únicamente para presentación.
El servidor Node.js deberá comprobar autenticación, pertenencia, `status`,
roles y permisos en CADA endpoint/operación Socket.IO. No confiar en `isAdmin`
enviado desde el navegador. No activar `EXPO_PUBLIC_BACKEND_PROVIDER=node`.

## Instalación

Aplicar 1A, 1B y 1C previamente. Descomprimir este paquete en la raíz del
proyecto, conservando las rutas. Ejecutar:

```bash
node --test tests/backend-phase1a.test.mjs tests/backend-phase1b.test.mjs tests/backend-phase1c.test.mjs tests/backend-phase1d.test.mjs
git diff --check
npx expo start --web --clear
```

## Validación manual obligatoria

Inicio de sesión por contraseña; registro y correo; recuperación de contraseña;
cierre de sesión; acceso invitado; restauración de sesión; bloqueo de cuenta;
accesos admin/tester/user; permisos de funcionalidades. Repetir en iPad/iPhone.

## Pendientes antes de retirar Convex

Implementar autenticación Node segura, sesiones, correo, migración de usuarios,
revocación y pruebas end-to-end. Migrar consultas administrativas restantes;
esta entrega no pretende haber eliminado todas las referencias a Convex.
