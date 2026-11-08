# Shopp — Fase 1E: consolidación y auditoría

## Alcance

Esta entrega se instala **después de las fases 1A, 1B, 1C y 1D**. No instala Express, PostgreSQL ni Socket.IO y no altera el esquema Convex.

## Corrección de ListsContext

Antes, el efecto que guardaba listas dependía de `userStorageKey` y de un indicador booleano `isReady`. Al cambiar de usuario, React podía ejecutar el efecto de persistencia con las listas del usuario previo y la nueva clave, antes de completar la lectura de esa nueva clave.

Ahora `loadedStorageKey` registra la clave que realmente ha sido hidratada. Solo se guarda cuando `loadedStorageKey === userStorageKey`. Las cargas asíncronas obsoletas siguen siendo canceladas lógicamente. Los errores de guardado asíncrono se registran sin provocar una promesa rechazada sin manejar.

No cambian las claves, el formato JSON ni la política de almacenamiento local.

## Validación

```bash
node --test tests/backend-phase1{a,b,c,d,e}.test.mjs
git diff --check
npx expo start --web --clear
```

Las pruebas son **estructurales**; no certifican compilación Expo, operaciones reales, integridad de almacenamiento en dispositivos ni seguridad de autorización.

## Dependencias Convex pendientes

La aplicación contiene numerosos módulos que siguen importando `convex/react` o `@/convex/_generated/api` directamente. La capa API creada no cubre todas las capacidades. Categorías observadas: administración de usuarios y permisos; escáner e historial; productos; ofertas; parking; Shopp Live/WebRTC; playlists, tarjetas e impresión; P2P; pantallas de Biblioteca; servicios de exportación; y navegación.

Antes de activar Node como proveedor es necesario diseñar contratos, migrar cada una de estas rutas y comprobar reglas de autorización en el servidor. **No establecer** `EXPO_PUBLIC_BACKEND_PROVIDER=node` todavía.

## Prueba manual prioritaria

1. En una sesión de un usuario A, añadir una lista local; cerrar sesión.
2. Iniciar sesión con otro usuario B y comprobar que no aparecen listas de A.
3. Crear listas de B, reiniciar la web y comprobar persistencia de B.
4. Volver a A y comprobar que sus listas originales continúan intactas.
5. Repetir el cambio entre invitado y usuario identificado, también en iPad.

**Advertencia:** no utilizar datos importantes sin copia de seguridad durante la validación. No se ha ejecutado una prueba funcional con base de datos real ni con Expo en esta entrega.
