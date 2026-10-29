# Shopp — compatibilidad QR, LRC y carátulas (18-10-2026)

Base: shopp-main(20261018-190107).zip.

## Cambios
- `comparePublicPlaylist` evita falsas discrepancias por campos auxiliares opcionales `lyricsUrl` y `coverUrl` al comprobar una publicación.
- Detecta cambios efectivos de título, artista, identificadores YouTube y orden de pistas.
- `PublicMusicCardScreen` normaliza `coverUrl` para futuras carátulas públicas (todavía no modifica la UI ni admite cargas de archivos de imagen).
- Conserva las cuatro vistas, reproducción continua y LRC sincronizados. No cambia ID de QR ni exportación/importación.

## Instalación
Copiar los tres archivos JS respetando sus rutas. La prueba nueva es opcional. Ejecutar `node --test tests/music-cards-qr.test.mjs tests/public-manifest-compatibility.test.mjs`.

## Carátulas por pista
El manifiesto público v1 ya permite `coverUrl` opcional (URL HTTPS o ruta pública desde `/`). El JSON privado puede guardar ese dato en cada pista. Aún NO se ha implementado selector de imágenes, almacenamiento de binarios en IndexedDB, exportación de imágenes al ZIP ni visualización de carátulas personalizadas.

## Verificar publicación
Los JSON de `public` deben publicarse en Netlify. Para publicar LRC comerciales hace falta autorización. El ID `shopp-9042796ee2f16f9a` permanece estable para la playlist aportada.
