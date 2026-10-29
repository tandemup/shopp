# Documentación de Shopp

> **Estado documental:** consolidación del ZIP `md(1).zip` (29-10-2026). La documentación técnica base fue elaborada en revisiones anteriores (principalmente septiembre de 2026); **no implica una auditoría del código vigente**. Revisar rutas, versiones y comportamiento contra el repositorio antes de aplicar cambios.

Shopp es una aplicación Expo / React Native / React Native Web (PWA), con funcionalidades de compras, escáner, tiendas, biblioteca, música, comunicación y administración, y backend Convex para los servicios que requieren identidad o sincronización. El funcionamiento exacto depende de la versión del repositorio.

## Documentación activa

1. [ARQUITECTURA.md](ARQUITECTURA.md): estructura del cliente, Convex, persistencia, esquema y directorios.
2. [FUNCIONALIDADES.md](FUNCIONALIDADES.md): módulos, playlists, QR, chat y pruebas funcionales.
3. [ALMACENAMIENTO.md](ALMACENAMIENTO.md): datos locales, IndexedDB, backups, migraciones y limitaciones documentadas.
4. [DESARROLLO_DESPLIEGUE.md](DESARROLLO_DESPLIEGUE.md): instalación, variables, Git, Convex, Netlify y EAS.
5. [SEGURIDAD_MANTENIMIENTO.md](SEGURIDAD_MANTENIMIENTO.md): autorización, privacidad, QA, limpieza y mantenimiento.

## Histórico

La carpeta [historico/](historico/) conserva los documentos fuente no duplicados, organizados por tema. **No tratar los procedimientos antiguos como actuales.** Las migraciones y calibraciones por fases sirven como evidencia y referencia, no como guía automática.

## Reglas de mantenimiento

- Actualizar estos seis documentos al cambiar el código correspondiente.
- No incluir secretos ni archivos `.env` reales en Git.
- Evitar copiar ficheros de código fuente completos a Markdown.
- Antes de borrar ficheros del repositorio, comprobar sus referencias, scripts, assets y despliegue.
- Validar funciones en Web, iOS y Android cuando corresponda.

## Alcance

El ZIP solo contiene documentos; no permite verificar contra el repositorio fuente el estado de tareas recientes, como reproducción automática iOS, sincronización musical, acceso invitado o P2P. Esas decisiones deben contrastarse con el código actual.
