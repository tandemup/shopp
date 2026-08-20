# Revisión del almacenamiento local de Shopp

Proyecto revisado: `shopp-pwa-main(20260814-174057)`  
Fecha: 14 de agosto de 2026

## Resumen ejecutivo

La base actual es válida para guardar imágenes de productos en la PWA: IndexedDB conserva objetos `Blob` mediante structured clone y se generan dos variantes JPEG, miniatura de 64 px y detalle de 256 px. Sin embargo, todavía no existe un sistema multimedia general ni una copia de seguridad completa.

Estado actual:

| Capacidad | Estado | Observación |
|---|---:|---|
| Datos JSON en IndexedDB web | Parcial | Funciona a través de `storage.web.js` |
| Imágenes Blob en IndexedDB | Sí, solo web | Dos blobs por código de barras |
| Imágenes en iOS/Android | Implementación parcial | La capa nativa existe, pero `productImageStorage.js` la bloquea |
| Audio y vídeo | No | No hay API de dominio, metadatos ni pantallas que los gestionen |
| Exportación JSON | Parcial | No incluye blobs ni todos los espacios de almacenamiento |
| Importación/restauración | No | No hay flujo inverso de la exportación |
| Sincronización de archivos | No | Convex sincroniza metadatos, no los blobs locales |
| Control de cuota y persistencia | No | No se consulta `navigator.storage.estimate()` ni se solicita persistencia |

## Arquitectura encontrada

### Web

- Base IndexedDB: `shopp-local-storage`.
- Versión: `1`.
- Object store único: `entries`.
- Claves y valores sin esquema interno ni índices.
- `storage.web.js` ofrece operaciones para texto, JSON y archivos.
- Los archivos se guardan como `{ blob, metadata, updatedAt }`.

### iOS y Android

- JSON y texto: AsyncStorage.
- Archivos: `expo-file-system`, bajo `documentDirectory/shopp-local/`.
- AsyncStorage conserva el descriptor y la ruta del fichero.

### Imágenes de producto

`productImageStorage.js` guarda:

- `@shopping/product-images/{barcode}/thumbnail`
- `@shopping/product-images/{barcode}/detail`

Cada valor incluye el blob JPEG y metadatos como tamaño, tipo MIME, variante, origen y fecha.

## Problemas importantes

### 1. La copia de seguridad actual no contiene imágenes

La exportación construida en `MenuScreen.js` solo serializa usuario, listas, compras e historial de escaneos. Los blobs de IndexedDB no pueden entrar directamente en JSON y no se recorren las claves de imágenes.

Consecuencia: al restaurar el JSON en otro navegador aparecerán los productos, pero no sus imágenes locales.

### 2. No existe importación

Se puede descargar un JSON, pero no hay lector, validación, migración de versión, modo de reemplazo o mezcla ni restauración transaccional.

### 3. El historial usa otro almacenamiento en web

`scannerHistory.js` usa `localStorage` en web, mientras que la API principal usa IndexedDB. Esto fragmenta los datos y provoca diferencias:

- `clearStorage()` limpia claves `@shopping/` de IndexedDB, pero no `scanner_history_v1` de `localStorage`.
- Una exportación genérica de IndexedDB no recogería el historial.
- Hay varias convenciones de claves para conceptos similares.

### 4. La API multimedia no es general

`setFile/getFile/removeFile` son primitivas, pero no hay funciones para:

- listar archivos por propietario o tipo;
- guardar audio o vídeo;
- obtener metadatos sin cargar el blob;
- sustituir un archivo de forma atómica;
- comprobar integridad;
- detectar y eliminar archivos huérfanos;
- calcular el espacio ocupado.

### 5. El borrado de productos no borra necesariamente sus imágenes

El historial elimina el registro, pero no llama sistemáticamente a `removeProductImages(barcode)`. Esto puede dejar blobs huérfanos en IndexedDB.

### 6. La implementación nativa está desconectada

`storage.native.js` soporta archivos mediante `expo-file-system`, pero `saveProductImageBlobs()` rechaza toda plataforma que no sea web y exige objetos `Blob`. Por tanto, la API no es realmente multiplataforma.

### 7. No hay gestión de cuota

IndexedDB comparte la cuota de almacenamiento asignada por el navegador al origen. El espacio no es ilimitado y el navegador puede desalojar datos en ciertas condiciones. La app debería:

- mostrar uso y cuota con `navigator.storage.estimate()`;
- intentar `navigator.storage.persist()` después de una acción del usuario;
- manejar explícitamente `QuotaExceededError`;
- limitar tamaño y tipos MIME, especialmente en vídeo.

### 8. Robustez transaccional limitada

La utilidad IndexedDB espera el resultado de cada request, no el evento `transaction.oncomplete`. Para operaciones compuestas y restauraciones hace falta resolver solo cuando finalice la transacción completa y abortarla ante cualquier error.

## API recomendada

Conviene separar datos estructurados y recursos binarios, manteniendo una fachada común:

```js
export const localData = {
  get(key, fallback),
  set(key, value),
  remove(key),
  list({ prefix }),
};

export const localMedia = {
  put({ id, ownerType, ownerId, kind, variant, data, mimeType, fileName }),
  get(id),
  getMetadata(id),
  list({ ownerType, ownerId, kind }),
  remove(id),
  removeByOwner(ownerType, ownerId),
  getUsage(),
};

export const localBackup = {
  export({ includeMedia: true }),
  inspect(file),
  restore(file, { mode: "merge" }),
};
```

Modelo recomendado para cada recurso:

```js
{
  id: "product:9788499171425:image:detail",
  ownerType: "product",
  ownerId: "9788499171425",
  kind: "image",          // image | audio | video | document
  variant: "detail",      // original | thumbnail | detail | preview
  blob: Blob,
  mimeType: "image/jpeg",
  fileName: "detail.jpg",
  size: 18342,
  checksum: "sha256-...",
  createdAt: 1786720000000,
  updatedAt: 1786720000000,
  schemaVersion: 1
}
```

## Esquema IndexedDB recomendado

Subir la base a una nueva versión y crear stores separados:

| Store | Contenido | Índices sugeridos |
|---|---|---|
| `records` | JSON de aplicación | clave |
| `media` | blobs y metadatos | `ownerId`, `kind`, `[ownerType, ownerId]`, `updatedAt` |
| `backupMeta` | manifiestos y migraciones | `createdAt`, `schemaVersion` |

No es obligatorio migrar inmediatamente todos los datos. Durante una versión se puede leer primero el esquema nuevo y, si falta el dato, recurrir a `entries` y migrarlo al escribir.

## Formato de copia de seguridad

Para una copia completa se recomienda un ZIP, no un JSON único:

```text
shopp-backup-20260814.zip
├── manifest.json
├── data.json
└── media/
    ├── product-9788499171425-image-thumbnail.jpg
    └── product-9788499171425-image-detail.jpg
```

`manifest.json` debe contener versión del formato, fecha, hashes SHA-256, tamaño, tipo MIME y relación entre cada fichero y su propietario. La restauración debe validar primero todo el ZIP y escribir después dentro de transacciones; si falla, no debe dejar una restauración parcial.

No recomiendo convertir imágenes, audio o vídeo a Base64 dentro del JSON: aumenta el tamaño aproximadamente un 33 %, consume mucha memoria y dificulta manejar vídeos grandes.

## Política para audio y vídeo

- Guardar `Blob` directamente en IndexedDB web.
- En nativo, copiar el archivo a `documentDirectory`, nunca a `cacheDirectory` si debe conservarse.
- Mantener en la base únicamente metadatos y la referencia estable.
- Definir límites por archivo antes de importar.
- Para vídeo, generar una miniatura o preview; no cargar el blob completo para listar elementos.
- Usar streaming o URL temporal al reproducir y revocar siempre las URLs `blob:`.

## Plan de implementación

1. Unificar todas las claves locales bajo la fachada `storage`; migrar `scannerHistory`, ajustes y preferencias que usan AsyncStorage/localStorage directamente.
2. Crear `localMedia` con soporte de imágenes, audio y vídeo, metadatos, listado y borrado por propietario.
3. Hacer que eliminar un producto elimine también sus recursos locales.
4. Añadir diagnóstico de almacenamiento: uso, cuota, persistencia y número de recursos.
5. Implementar backup ZIP completo con manifiesto, datos y blobs.
6. Implementar inspección y restauración `merge`/`replace`, con validación y versiones.
7. Añadir pruebas de guardar, leer, sustituir, borrar, cuota agotada, backup y restauración en otro navegador.

## Prioridad recomendada

Antes de añadir audio y vídeo, conviene completar primero la API `localMedia` y el backup ZIP. Si se añaden vídeos sobre el store genérico actual, crecerán rápidamente los blobs sin herramientas para medirlos, exportarlos o limpiar huérfanos.

