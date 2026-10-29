# Invitaciones para betatesters

En **Administración > Usuarios**, introduce el email y pulsa **Crear invitación**.
La invitación caduca en 7 días. Comparte manualmente la URL de Shopp: el sistema no envía correos de invitación automáticamente.
El tester debe registrarse desde **Registro tester** en la pantalla En desarrollo, emplear exactamente el correo autorizado y verificarlo con el código de Convex Auth.
Después de verificar, el servidor comprueba la invitación, asigna el rol tester y los permisos iniciales.
Para usuarios ya registrados, cambia el rol desde Administración > Usuarios (Usuario → Tester → Admin → Usuario) y aplica **Acceso inicial** en Utilidades.

Despliega las funciones y el esquema con `npx convex dev` en desarrollo o `npx convex deploy` en producción, según tu flujo de despliegue. No se ha modificado la configuración de Netlify.
