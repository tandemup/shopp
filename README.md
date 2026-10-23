# Shopp — documentación consolidada

**Actualización documental:** 23 de octubre de 2026.  
**Origen:** consolidación de `md.zip` (documentación con revisiones de fechas y versiones diferentes) y estado funcional comunicado durante octubre de 2026.  
**Alcance de la verificación:** se han revisado los documentos entregados, **no el código fuente de la revisión actual**. Las indicaciones de implementación se deben contrastar con el repositorio antes de aplicarlas.

## 1. Qué es Shopp

Shopp es una aplicación modular de utilidades basada en **JavaScript, Expo, React Native y React Native Web**, destinada a navegadores/PWA y dispositivos iOS y Android. La aplicación comenzó como gestor de listas de compra y ahora incluye escáner de productos, tiendas, Biblioteca de enlaces, Music y Classical Playlists, tarjetas musicales QR, chat, Parking, WebRTC Live, Fire Alarm y herramientas administrativas. Las funciones disponibles dependen de la modalidad de acceso, permisos y plataforma.

**Principios:** almacenar localmente datos personales cuando sea viable; evitar consultas y coste Convex innecesarios; mantener exportación/recuperación verificable; proteger el acceso por roles en el backend; separar el contenido público de las bibliotecas privadas.

## 2. Arquitectura y persistencia

| Elemento | Función / estado documentado |
|---|---|
| `App.js`, navegación, contextos | Entrada de la aplicación, proveedores globales, autenticación y rutas de pantallas. |
| Expo + React Native Web | Interfaz compartida, con comportamientos específicos según navegador y dispositivo. |
| Convex + Convex Auth | Autenticación y servicios remotos que todavía lo requieren (p. ej., chat, presencia/señalización P2P, ciertas funciones de tiendas y Parking). |
| IndexedDB (Web/PWA) | Objetivo y migración de Biblioteca, Music Playlist y Classical Music, incluidas letras LRC donde esté implantado. |
| Almacenamiento local nativo | No asumir equivalencia con IndexedDB web; comprobar implementaciones `.native.js` y la persistencia de cada módulo. |
| Netlify + `public/` | Hosting web/PWA y distribución pública de fichas JSON, landing QR y recursos estáticos. |
| YouTube iframe/API | Reproducción de vídeos; depende de conexión y restricciones del navegador. |
| WebRTC DataChannel | Intercambio de datos entre dispositivos; Convex puede conservar el plano de señalización. |

**Precaución:** los documentos originales contienen descripciones contradictorias sobre qué datos residen todavía en Convex; varias se redactaron antes de la migración a IndexedDB. No interpretar esta síntesis como una auditoría del despliegue real. IndexedDB, además, **es independiente por navegador y origen**: Safari y Chrome no comparten la misma base; las copias de seguridad y sincronización son importantes.

## 3. Módulos

- **Compras y archivo:** listas, artículos, unidades/precios, promociones, tiendas asociadas, listas archivadas e histórico.
- **Productos y escáner:** lectura de códigos de barras, búsqueda externa, cachés y permisos de cámara; el almacenamiento de imágenes debe someterse a revisión de respaldo e importación.
- **Tiendas / Parking:** favoritos, proximidad, mapas, ubicación y mensajes/estados de aparcamiento según permisos.
- **Biblioteca:** enlaces y noticias con carpetas, etiquetas, búsquedas, importación/exportación JSON e intercambio P2P. En las notas de prueba, la sincronización P2P envía lotes de hasta 48 KiB, resuelve conflictos por `updatedAt` y propaga borrados; validar estos detalles frente al código vigente.
- **Music / Classical:** colecciones, orden de pistas, YouTube, letras `.lrc`, exportación local, reproductores y modo público; se recomienda disponer de una copia ZIP v2 por navegador antes de migraciones.
- **Comunicación:** chat, Shopp Live y Fire Alarm; WebRTC transporta medios entre peers o vía TURN, mientras Convex puede señalizar conexiones.
- **Identidad:** registro y acceso por correo, contraseñas/códigos temporales según configuración, perfiles, alias, administración y modo Invitado restringido.

Los módulos opcionales o experimentales no deben presentarse como universalmente activos sin comprobar permisos, rutas y disponibilidad de plataforma.

## 4. Playlists, archivos LRC y carátulas

### Modelo local y respaldo

La documentación de las fases de migración describe operaciones locales para Music y Classical, aislamiento de letras y una herramienta **Verificar datos** para detectar pistas con LRC faltantes y claves huérfanas. La exportación **ZIP/JSON v2** es el formato recomendado cuando se necesitan letras; un respaldo JSON v1 antiguo no incluye necesariamente el texto LRC. Convex puede seguir interviniendo en autenticación, migraciones manuales y señalización P2P, aunque no en el uso rutinario local.

Las letras sincronizadas utilizan archivos `.lrc` asociados a canciones y se muestran en una sola línea bajo el vídeo en el reproductor público según las revisiones recientes. Si un LRC no existe, la reproducción de la pista debe seguir siendo válida.

### Carátulas

El manifiesto público v1 admite `coverUrl` **opcional**; la documentación del 18 de octubre indicaba que todavía no había selector para cargar imágenes, almacenamiento binario de carátulas en IndexedDB ni exportación de imágenes al ZIP. Por tanto, **no considerar esas funciones implementadas sin revisar el código más reciente**. Mantener un comportamiento de reserva (portada/miniatura convencional de YouTube) cuando no se declara imagen de pista. No exigir imagen ni alterar los datos existentes.

### Reproductor y limitaciones

Se han documentado modalidades **Simplificado, Completo, App · 1 col y App · 2 col**, controles por pista Play/Pause, Repeat 1, Next, acceso YouTube y letra sincronizada. El paso automático a la pista siguiente y el arranque automático son operaciones distintas: **iPhone/Safari y YouTube pueden impedir el inicio sin nueva interacción del usuario**. En pruebas del 22 de octubre, el siguiente vídeo se cargaba pero no se iniciaba automáticamente. No prometer reproducción continua sin interacción en todos los dispositivos.

## 5. Publicación pública y QR

Las playlists de IndexedDB **no son accesibles a otros teléfonos únicamente con su URL local**. Para compartir mediante un QR sin instalar Shopp ni iniciar sesión:

1. Desde Shopp, generar/exportar una **ficha pública JSON** de la playlist y los recursos que requiera (por ejemplo `.lrc` en el formato de publicación correspondiente).
2. Situarlos en `public/music-cards/` conservando la estructura y nombres de archivos relativos.
3. Publicar la compilación en Netlify. Verificar desde un navegador ajeno que la URL HTTPS de la ficha devuelve JSON y que las URL de letras, si existen, funcionan.
4. Probar la URL final desde el iPhone en Safari; después generar o imprimir el QR que apunta a la landing o reproductor público, y comprobar el resultado de escanearlo sin sesión.

**Ejemplo de ruta:** `https://ramworks.netlify.app/music-cards/ID_DE_PLAYLIST.json` (sustituir por el identificador publicado). No incluir sufijos como `utm_source` dentro del QR canónico. La ruta debe comprobarse tras cada despliegue.

Las fichas publicadas pueden ser accesibles a cualquiera con el enlace. Revisar sus campos: no deben contener claves, correos, identificadores privados ni datos de usuario innecesarios. Los derechos para distribuir archivos LRC y carátulas deben verificarse por separado.

### Tarjetas y dúplex

Se han preparado tarjetas de **90 × 56 mm**, **10 tarjetas por hoja A4**, con posibilidad de contenido distinto, QR o código y personalización de colores y líneas de corte. Para la Canon TS8750, imprimir una hoja de prueba a **escala 100 %**, sin ajuste automático, verificar orientación de giro y calibrar el anverso/reverso mediante controles de pantalla. Las notas históricas incluyen desplazamientos de 2 y 2,5 mm: **no deben codificarse como corrección universal**; dependen de la impresora, alimentación y papel. Ofrecer controles independientes para líneas del anverso, reverso y su representación en la cara contraria.

## 6. Instalación y desarrollo

**Requisitos:** Node.js/npm compatibles con la versión real del proyecto, dependencias instaladas, proyecto Convex y acceso al despliegue Netlify. Revisar `package.json`, `netlify.toml` y `app.json` antes de fijar versiones (la documentación original mezcla revisiones).

```bash
cd ~/Developer/shopp
npm install
npx convex dev                # backend de desarrollo, cuando proceda
npx expo start --web          # web local
# o, para compartir en LAN:
npx expo start --web --host lan
```

En el Mac, abrir `http://localhost:8081` cuando sea el puerto asignado; en iPad/iPhone utilizar `http://IP_DEL_MAC:PUERTO` estando en la misma red. Algunas API de cámara, servicio PWA y otras capacidades exigen HTTPS u origen seguro: un host HTTP de la LAN puede no reproducir el entorno de producción. Para estas pruebas utilizar un despliegue HTTPS de Netlify o una configuración HTTPS confiable.

### Configuración de entorno

- `EXPO_PUBLIC_CONVEX_URL`: URL del deployment Convex correspondiente al entorno.
- `EXPO_PUBLIC_APP_MODE`, `EXPO_PUBLIC_ACCESS_MODE`: opciones de modalidad/pantalla de acceso **si existen en el código actual**.
- Otras variables: contrastarlas con los usos reales de `process.env` / configuración Expo; no inventar nombres.
- **Nunca** introducir tokens, contraseñas, claves API privadas o credenciales en variables `EXPO_PUBLIC_*`: quedan expuestas al cliente. Los secretos de correo/Convex deben configurarse en su servidor correspondiente.
- Los archivos `.env*` locales y credenciales reales no deben incorporarse al ZIP documental ni versionarse.

## 7. Git, PR y Netlify

Flujo recomendado para la rama de trabajo `develop`:

```bash
git status --short
git checkout develop
git pull --ff-only origin develop
# aplicar cambios y ejecutar pruebas
git add <rutas-revisadas>
git commit -m "Docs: consolidar documentación de Shopp"
git push origin develop
```

Después, abrir **pull request de `develop` a `main`**, revisar y fusionar. Netlify publicará la rama ligada al entorno configurado; verificar los logs y la URL resultante. Si está habilitado el despliegue de rama, comprobar `https://develop--ramworks.netlify.app` (no asumir que existe sin verificarlo). Para generar estáticos localmente, comprobar el script de `package.json` y usar, según la revisión, `npm run build` o `npx expo export -p web`. Revisar en Netlify la carpeta de publicación y las reglas de redirección.

**No es necesario hacer PR/merge para cada iteración** si puede probarse en Expo LAN o en un deploy preview HTTPS; sí hace falta publicar estáticos para que el iPhone acceda a un QR público.

## 8. Validación imprescindible

| Área | Pruebas mínimas |
|---|---|
| Datos locales | Crear, editar, cerrar y reabrir Music/Classical; ejecutar «Verificar datos»; exportar ZIP v2 y restaurar en un perfil de prueba. |
| Independencia | Comprobar que Music y Classical no intercambian LRC y que Safari/Chrome mantienen copias distintas. |
| P2P | Mac ↔ iPad, misma cuenta, dispositivos diferenciados, confirmar intercambio y resolución de cambios/duplicados. |
| Reproductor público | Safari/Chrome Mac e iPhone; QR sin login, una línea LRC, paso a siguiente pista, autoplay, Repeat 1, controles móviles, portrait/landscape iPad. |
| Publicación | URL HTTPS de `.json`, `.lrc` y demás recursos públicos; comprobar 404 y contenido MIME correcto. |
| Impresión | A4, 10 tarjetas, escala 100 %, registro dúplex, márgenes/corte y lectura real del QR con cámara. |
| Backend y coste | Examinar logs de Convex: en uso rutinario local de playlists no deberían aparecer llamadas innecesarias a `playlists.*`; aislar de pruebas de migración/P2P. |
| Seguridad | Roles comprobados en servidor, acceso Invitado limitado, ausencia de secretos y datos personales en JSON público. |

Pruebas existentes citadas en documentación histórica: `node --test tests/playlist*test.mjs`, `node --test tests/music-cards-qr.test.mjs` y pruebas específicas de compatibilidad. **Sus resultados históricos no certifican el estado del repositorio actual**.

## 9. Incidencias y trabajo pendiente

1. **Autoplay iPhone:** el vídeo siguiente se carga pero puede no arrancar; analizar interacción de usuario, eventos iframe y políticas de Safari/YouTube sin recurrir a promesas incompatibles con el navegador.
2. **Carátulas por pista:** verificar si el editor actual acepta subir imágenes, dónde se guardan, cómo se exportan y el fallback cuando no se especifican.
3. **Compatibilidad web/PWA:** revisar IndexedDB en Safari iPhone, scroll de las pantallas, iPad en vertical y persistencia cuando se instala como PWA.
4. **Publicación QR:** comprobar enlaces sin parámetros de seguimiento, integridad de los `.lrc`, estructura `public/music-cards` y ausencia de acceso autenticado obligatorio.
5. **Respaldo:** completar pruebas de copia/restauración de imágenes y otros adjuntos; comprobar qué datos quedan fuera de exportaciones.
6. **Costes Convex:** auditar las consultas reactivas reales y reducirlas donde las utilidades ya tienen persistencia local.
7. **Código histórico:** revisar pantallas de depuración, documentación Heroku/Socket.IO antigua y snapshots de archivos antes de eliminarlos. No borrar módulos sin verificar importaciones y tests.

## 10. Política de mantenimiento documental

Este documento sustituye como **referencia resumida** a los tutoriales, fases y copias documentales del ZIP recibido. No sustituye al historial Git ni al código. Actualizar aquí: fecha, arquitectura confirmada, interfaces, procedimientos verificables y tareas pendientes. No añadir volcados completos de ficheros fuente ni contraseñas. Mantener fases antiguas en el historial Git, no como manuales operativos concurrentes.

**Criterio de fiabilidad:** «implementado» solo cuando está comprobado en la revisión actual; «documentado» cuando aparece en las notas anteriores; «pendiente» cuando debe verificarse o resolverse.
