import { Image, Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { isPlaylistArtwork, playlistArtworkFromImage } from './playlistArtwork';

const MAX_SIDE = 512;
const withinLimit = ({ width, height }) =>
  width > 0 && height > 0 && Math.max(width, height) <= MAX_SIDE;

export function getPlaylistArtworkSize(uri) {
  return new Promise((resolve, reject) => {
    const pending = Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
    pending?.then?.(resolve, reject);
  });
}

export async function preparePlaylistArtwork(uri, { picked = false, mimeType = '' } = {}) {
  if (!uri) return '';
  if (!picked && !isPlaylistArtwork(uri)) {
    throw new Error('Usa una URL HTTPS o sustituye la imagen dañada.');
  }

  let size;
  try {
    size = await getPlaylistArtworkSize(uri);
  } catch {
    throw new Error('No se pudo abrir la carátula. Elige otra imagen o quítala.');
  }
  if (!picked && withinLimit(size)) return uri;

  const scale = Math.min(1, MAX_SIDE / Math.max(size.width, size.height));
  const resize = {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
  // PNG retains transparency for covers that already have it.
  const format = /^image\/(png|webp)$/i.test(mimeType) ||
    /^data:image\/(png|webp)[;,]|\.(png|webp)(?:[?#]|$)/i.test(uri)
    ? SaveFormat.PNG : SaveFormat.JPEG;
  let processed;
  try {
    processed = await manipulateAsync(uri,
      withinLimit(size) ? [] : [{ resize }],
      { format, compress: 0.86, base64: true });
  } catch {
    throw new Error(uri.startsWith('https://')
      ? 'No se pudo redimensionar la carátula de esa URL. Elige el archivo desde el dispositivo.'
      : 'No se pudo preparar la carátula. Elige otra imagen.');
  }
  if (!withinLimit(processed)) throw new Error('La carátula supera 512 × 512 px.');
  return playlistArtworkFromImage(processed);
}

export async function preparePickedPlaylistArtwork(asset) {
  // Decode the original file in the browser instead of passing a large data URL.
  const objectUrl = Platform.OS === 'web' && asset.file ? URL.createObjectURL(asset.file) : null;
  try {
    return await preparePlaylistArtwork(objectUrl || asset.uri, {
      picked: true,
      mimeType: asset.file?.type || asset.mimeType || '',
    });
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
