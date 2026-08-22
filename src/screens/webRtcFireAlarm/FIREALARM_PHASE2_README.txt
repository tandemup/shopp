Fire Alarm - Fase 2/3

Archivos modificados:
- convex/schema.js
- convex/fireAlarm.js (nuevo)
- convex/_generated/api.d.ts
- src/screens/webRtcFireAlarm/WebRtcFireAlarmScreen.js

Qué añade:
1. Tabla fireAlarms en Convex.
2. Captura JPEG desde la webcam y subida a Convex Storage.
3. Creación de alarma autenticada.
4. Historial de alarmas del usuario.
5. Vista de alarmas activas para administradores en tiempo real.
6. Acciones de administrador: confirmar recepción y resolver.
7. Acción del usuario: cancelar una alarma activa.

Después de copiar los archivos, ejecuta desde la raíz del proyecto:

  npx convex dev

Esto desplegará el nuevo schema y convex/fireAlarm.js y regenerará los archivos _generated.

Después inicia Expo/Netlify como haces normalmente.

Prueba recomendada:
- Navegador A: iniciar sesión como usuario normal, abrir Fire Alarm, activar cámara y enviar alarma.
- Navegador B: iniciar sesión como administrador y abrir Fire Alarm.
- La alarma debería aparecer en B sin refrescar la página.

Todavía NO incluye vídeo WebRTC en directo ni notificaciones Push. Esa será la siguiente fase.
