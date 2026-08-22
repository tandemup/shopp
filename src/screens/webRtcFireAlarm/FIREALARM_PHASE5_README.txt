Fire Alarm - Fase 5: TURN-ready + diagnóstico WebRTC

Novedades
- STUN activo por defecto.
- Soporte opcional TURN mediante variables EXPO_PUBLIC_*.
- Diagnóstico del transporte: P2P local, P2P/STUN o TURN relay.
- Resolución real y FPS de la webcam.
- Resolución/FPS del vídeo recibido cuando getStats() los proporciona.
- Indicador visual de configuración TURN.

Variables
EXPO_PUBLIC_FIREALARM_TURN_URL=turn:tu-servidor:3478
EXPO_PUBLIC_FIREALARM_TURN_USERNAME=usuario
EXPO_PUBLIC_FIREALARM_TURN_CREDENTIAL=credencial

También puede usarse turns:...:5349 si el servidor ofrece TURN/TLS.

Después de copiar
1. Ejecuta `npx convex dev`.
2. Arranca la PWA.
3. Emisor: activar cámara -> AVISAR DE INCENDIO.
4. Administrador: Ver cámara en directo.
5. Comprueba el estado WebRTC, transporte y resolución.

Importante
- Sin las variables TURN, la aplicación sigue funcionando con STUN/P2P.
- Esta fase deja preparada la integración TURN; no instala un servidor TURN.
- Las EXPO_PUBLIC_* son visibles en el navegador. En producción conviene usar
  credenciales TURN temporales, no una contraseña estática de larga duración.
- Convex transporta señalización, no vídeo.
