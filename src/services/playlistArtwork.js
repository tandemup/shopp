const MAX_COVER_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BASE64_LENGTH = 4 * Math.ceil(MAX_COVER_BYTES / 3);

export function isPlaylistArtwork(value) {
  if (typeof value !== 'string' || !value || value.length > MAX_COVER_BASE64_LENGTH + 23) return false;
  if (/^https:\/\/[^\s]+$/i.test(value) && value.length <= 2048) {
    try {
      const url = new URL(value);
      return Boolean(url.hostname) && !url.username && !url.password;
    } catch { return false; }
  }
  const image = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!image || image[2].length % 4 !== 0) return false;
  const encoded = image[2];
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return (encoded.length * 3) / 4 - padding <= MAX_COVER_BYTES;
}

export function playlistArtworkFromImage(asset) {
  const base64 = asset?.base64 || /^data:image\/[^;,]+;base64,(.+)$/i.exec(asset?.uri || '')?.[1];
  if (!base64) throw new Error('No se pudo leer la imagen seleccionada.');
  // The picker can return JPEG bytes even when the source file was another format.
  const format = base64.startsWith('/9j/') ? 'jpeg'
    : base64.startsWith('iVBORw0KGgo') ? 'png'
    : /^UklGR[\w+/]{6}XRUJQ/.test(base64) ? 'webp'
    : null;
  if (!format) throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  const artwork = `data:image/${format};base64,${base64}`;
  if (!isPlaylistArtwork(artwork)) throw new Error('La carátula debe ser una imagen válida de hasta 2 MB.');
  return artwork;
}
