Fire Alarm - Fase 4 WebRTC

Archivos:
- convex/fireAlarm.js
- convex/schema.js
- src/screens/webRtcFireAlarm/WebRtcFireAlarmScreen.js

Qué añade:
- Tabla fireAlarmSignals para señalización WebRTC.
- Offer/answer/ICE transportados por Convex.
- El emisor inicia la oferta al crear la alarma.
- El administrador puede pulsar "Ver cámara en directo".
- El vídeo usa RTCPeerConnection; Convex NO transporta el vídeo.
- STUN de prueba: stun:stun.l.google.com:19302.

Después de copiar:
1. Ejecuta: npx convex dev
2. Prueba con dos usuarios distintos.
3. En el equipo emisor: activa cámara y envía alarma.
4. En el administrador: abre Fire Alarm y pulsa "Ver cámara en directo".

Limitación:
Sin TURN, algunas redes móviles, CGNAT, firewalls o NAT restrictivos pueden impedir la conexión P2P.
