# Shopp · Publicación de playlists y tarjetas QR en Netlify

## Objetivo

Publicar una playlist de Shopp para que otra persona pueda abrirla desde el **QR de una tarjeta**, sin necesitar instalar Shopp ni iniciar sesión, utilizando la URL pública de Netlify.

Estas instrucciones amplían las instrucciones incluidas en el ZIP de exportación. **Descargar un ZIP desde Shopp no publica automáticamente ningún archivo en Netlify.**

> **Importante:** el ZIP exportado contiene recursos de la playlist, no una versión completa de la aplicación. **No lo arrastres a Netlify como si fuera el sitio web completo**. Sus archivos deben incorporarse a la carpeta `public/` del proyecto Shopp y después desplegar el proyecto.

## 1. Generar los archivos desde Shopp

1. Abre Shopp y entra en la playlist que quieres compartir.
2. Abre **Imprimir tarjeta**.
3. En la sección **Publicar playlist antes de imprimir**, elige **Incluir LRC autorizadas** solamente si puedes publicar esas letras.
4. Pulsa **1. Descargar ZIP para Netlify** (la etiqueta exacta puede variar ligeramente según la versión).
5. Localiza el ZIP descargado, normalmente en **Descargas** del Mac.
6. Descomprímelo. Comprueba que contiene una carpeta denominada `music-cards/`.

Dentro de `music-cards/` debe existir, como mínimo, el JSON correspondiente a la playlist exportada. Si se incluyen letras, puede haber subcarpetas y archivos `.lrc` adicionales. **Conserva las rutas relativas tal como están**: no cambies el nombre del JSON ni muevas los `.lrc` fuera de su estructura.

## 2. Copiar `music-cards/` al proyecto local

Abre **Terminal** en el Mac:

```bash
cd ~/Developer/shopp
pwd
ls -la public
```

La carpeta de destino es:

```text
~/Developer/shopp/public/music-cards/
```

Desde Finder puedes copiar **el contenido exportado** a `public/music-cards/`. Si macOS pregunta si deseas fusionar carpetas, revisa la operación para **conservar los archivos de otras playlists**. Evita sustituir por completo una carpeta `music-cards` que ya contenga otras publicaciones.

Puedes abrir el destino desde Terminal:

```bash
open ~/Developer/shopp/public
```

**Estructura de ejemplo:**

```text
shopp/
├── public/
│   └── music-cards/
│       ├── shopp-101937558d9579a1.json
│       └── lyrics/
│           └── shopp-101937558d9579a1/
│               ├── 002.lrc
│               └── 003.lrc
└── ...resto del proyecto...
```

Los nombres de los `.lrc` son ilustrativos: usa los que realmente incluya tu ZIP. El identificador `shopp-101937558d9579a1` es el empleado en las pruebas de «Mis '80»; para otras playlists será distinto.

Comprueba qué archivos van a publicarse:

```bash
find public/music-cards -type f | sort
```

## 3. Guardar los cambios con Git

Desde la carpeta del proyecto:

```bash
cd ~/Developer/shopp
git status --short
git branch --show-current
```

Si trabajas en la rama `develop`, añade **solo los recursos públicos exportados** y súbelos:

```bash
git add public/music-cards/
git commit -m "Publish music card playlist assets"
git push origin develop
```

Si Git indica que no hay cambios para confirmar, comprueba que copiaste los archivos al directorio correcto y que no están ignorados por `.gitignore`:

```bash
git status --short public/music-cards/
git check-ignore -v public/music-cards/shopp-101937558d9579a1.json
```

Adapta el nombre del JSON al de tu exportación. No utilices `git add .` si hay cambios locales que no deseas incluir en la publicación.

## 4. Desplegar en Netlify

El despliegue depende de la configuración que ya tenga tu sitio conectado a Git:

- Si Netlify publica automáticamente `main` como producción, crea un **Pull Request** desde `develop` hacia `main` en GitHub, revísalo y haz **Merge**. Netlify debería iniciar el despliegue de producción.
- Si Netlify tiene desplegada también la rama `develop`, puedes probar primero su *branch deploy*, siempre que esté habilitado. Esa URL no sustituye a la de producción que utiliza el QR.
- Si el despliegue automático está desactivado, abre la consola de Netlify y ejecuta el despliegue del proyecto según su configuración.

**No subas el ZIP de la playlist directamente a la función de despliegue manual de Netlify:** eso podría publicar solo `music-cards/` en lugar de la aplicación Shopp.

Verifica en Netlify que el último despliegue de **producción** aparece como publicado correctamente antes de pasar al siguiente paso.

## 5. Comprobar el archivo JSON en producción

Para la playlist «Mis '80» del ejemplo, la URL esperada es:

```text
https://ramworks.netlify.app/music-cards/shopp-101937558d9579a1.json
```

Ábrela en Chrome o Safari. Debe aparecer **un documento JSON**, no la página de inicio de Shopp.

Puedes comprobarlo mediante Terminal:

```bash
curl -i https://ramworks.netlify.app/music-cards/shopp-101937558d9579a1.json
```

**Respuesta correcta:** estado HTTP `200`, contenido con estructura JSON y, normalmente, un tipo de contenido compatible con JSON como `application/json`. El JSON debe corresponder a la playlist que intentas imprimir (identificador y canciones).

**Respuesta incorrecta:** HTML (`<!doctype html>`, `<html>`, etc.), aunque el estado sea `200`. Significa que el servidor ha devuelto una página web en vez de la ficha JSON. Esto puede ocurrir cuando una redirección de la SPA sirve `index.html` para una ruta que no existe.

Si ves HTML:

1. Comprueba que el JSON existe físicamente en `public/music-cards/` con el **nombre exacto**, respetando mayúsculas y minúsculas.
2. Comprueba `git status` y que el archivo está confirmado en la rama desplegada.
3. Confirma que Netlify desplegó la versión nueva de la rama correcta y que el build copia los recursos de `public/`.
4. Comprueba que el QR y Shopp apuntan a `https://ramworks.netlify.app`, no a `localhost` ni a una versión antigua.
5. Repite la petición después de publicar el despliegue corregido.

**No es suficiente que la página de reproducción de Shopp abra:** el archivo de manifiesto JSON también debe ser accesible y correcto.

## 6. Verificar desde Shopp antes de imprimir

Una vez disponible el JSON público:

1. Vuelve a **Imprimir tarjeta**.
2. Comprueba que la **URL base pública** es `https://ramworks.netlify.app`.
3. Pulsa **3. Comprobar publicación**.
4. Si la comparación es satisfactoria, revisa la vista previa y pulsa el QR para abrir su URL real.
5. Solo entonces continúa a **Preparar impresión** y **Vista previa / Imprimir**.

Si Shopp presenta **«Pendiente de verificar: impresión bloqueada»**, no basta con haber descargado el ZIP. Primero debe existir la publicación correcta en Netlify y ser comprobable desde Shopp.

## 7. Probar la tarjeta en iPhone y otros dispositivos

1. Desde el iPhone, abre el QR con la cámara o abre su enlace HTTPS.
2. Verifica que la página pública muestra la playlist esperada.
3. Pulsa Play y comprueba el vídeo de YouTube.
4. Comprueba el paso a la siguiente canción y, si se han incluido, las letras sincronizadas.
5. Si Safari o Chrome bloquea el inicio automático de otro vídeo, anota el navegador y la versión: las políticas de reproducción automática pueden exigir una interacción del usuario.

## 8. Seguridad y derechos de autor

Los archivos JSON y `.lrc` que coloques en `public/` quedan accesibles mediante URL pública. **No exportes información privada ni letras sincronizadas cuya difusión no esté autorizada.** La opción «Incluir LRC autorizadas» debe usarse únicamente cuando tengas derecho a publicar esos contenidos.

## 9. Lista de comprobación

- [ ] ZIP de la playlist descargado y descomprimido.
- [ ] Contenido de `music-cards/` copiado a `public/music-cards/` sin borrar otras playlists.
- [ ] Archivos confirmados en Git y enviados a la rama adecuada.
- [ ] Pull Request y Merge realizados si producción depende de `main`.
- [ ] Despliegue de producción publicado en Netlify.
- [ ] URL del JSON devuelve JSON válido, no HTML.
- [ ] «Comprobar publicación» finaliza correctamente en Shopp.
- [ ] QR probado en el móvil antes de imprimir las tarjetas.

---

**Resumen del error de tus capturas:** «ZIP de publicación preparado» confirma solamente que Shopp creó los archivos descargables. «No se pudo comprobar la publicación» indica que esos archivos todavía no están disponibles como el JSON esperado en el sitio publicado, o que la URL/configuración de despliegue no coincide. Son etapas diferentes y deben completarse en ese orden.
