# Documentación del proyecto Shopp

**Repositorio analizado:** `shopp-main(9).zip`  
**Fecha de revisión:** 2026-09-04  
**Aplicación:** Shopp 1.0.0

Shopp es una aplicación multiplataforma construida con **Expo + React Native + React Native Web**, con **Convex** como backend reactivo y sistema de autenticación. La misma base de código sirve iOS, Android y Web/PWA.

El proyecto ya no es únicamente una lista de compra. El repositorio actual reúne varias utilidades relacionadas:

- listas de compra e histórico;
- tiendas, favoritos, ubicación y parking;
- escáner y catálogo de productos por código de barras;
- clasificación de productos (Alimentos, Supermercado, Libros y Música);
- chat y tratamiento de enlaces;
- Biblioteca de enlaces, noticias, periódicos y librerías;
- playlists de YouTube;
- Shopp Live mediante WebRTC;
- Fire Alarm mediante WebRTC;
- perfil, autenticación, roles administrativos y recuperación por correo;
- importación/exportación y copias ZIP locales.

## Índice de documentos

| Documento | Contenido |
|---|---|
| [01_VISION_GENERAL.md](01_VISION_GENERAL.md) | Objetivo, alcance, plataformas y capacidades. |
| [02_ARQUITECTURA.md](02_ARQUITECTURA.md) | Arquitectura cliente/backend, navegación, persistencia y flujos. |
| [03_MODULOS_FUNCIONALES.md](03_MODULOS_FUNCIONALES.md) | Descripción funcional y técnica por utilidad. |
| [04_MODELO_DATOS_CONVEX.md](04_MODELO_DATOS_CONVEX.md) | Tablas Convex, ownership y relaciones principales. |
| [05_DESARROLLO_LOCAL.md](05_DESARROLLO_LOCAL.md) | Instalación, variables, comandos y flujo de desarrollo. |
| [06_DESPLIEGUE_PWA_Y_EAS.md](06_DESPLIEGUE_PWA_Y_EAS.md) | Netlify, PWA y builds nativas con EAS. |
| [07_SEGURIDAD_Y_PRIVACIDAD.md](07_SEGURIDAD_Y_PRIVACIDAD.md) | Fronteras de confianza, secretos, WebRTC, permisos y datos. |
| [08_PRUEBAS_MANTENIMIENTO_Y_DEUDA_TECNICA.md](08_PRUEBAS_MANTENIMIENTO_Y_DEUDA_TECNICA.md) | Tests actuales, mantenimiento y deuda técnica observada. |
| [09_MAPA_DEL_REPOSITORIO.md](09_MAPA_DEL_REPOSITORIO.md) | Directorios y ficheros principales. |

## Stack principal detectado

- Expo `~57.0.18`
- React `19.2.3`
- React Native `0.86.3`
- React Native Web `^0.21.0`
- Convex `^1.42.2`
- `@convex-dev/auth`
- React Navigation 7
- Expo Camera / Location / File System / Image / Clipboard
- React Leaflet para mapas web
- ZXing / html5-qrcode para lectura de códigos
- Resend para OTP de correo
- Netlify para la exportación web/PWA
- EAS para builds iOS/Android

## Principio arquitectónico

La aplicación tiene dos dominios de persistencia diferentes y deliberados:

1. **Estado local del dispositivo**: listas, ajustes, cachés, historial local, imágenes locales y preferencias.
2. **Estado compartido/remoto en Convex**: identidad, perfiles, chat, parking, Biblioteca, caché compartida de productos, playlists, Fire Alarm, Shopp Live y otros datos sincronizados.

Esta distinción es importante: borrar un dato local **no implica** borrar su equivalente remoto, salvo que una función concreta implemente ambas operaciones.

## Estado de la documentación

Estos documentos describen el código presente en el ZIP analizado. Cuando la documentación histórica existente contradice al código actual, se toma el código como referencia.
