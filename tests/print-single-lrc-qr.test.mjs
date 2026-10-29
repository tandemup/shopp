import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/screens/playlist/PrintMusicCardScreen.js', import.meta.url), 'utf8');
test('QR individual Shopp carga ficha publicada y selecciona la canción correcta', () => {
  assert.match(source, /const publicSongUrl = buildPlaylistCardUrl\(origin, publicId, qrDestination\)/);
  assert.match(source, /`\$\{publicSongUrl\}&song=\$\{index\}`/);
  assert.match(source, /qrDestination !== "youtube" && publicSongUrl/);
});
test('La verificación de publicación cuenta LRC recuperados de IndexedDB', () => {
  assert.match(source, /const stored = await getLocalLyrics\(track\)/);
  assert.match(source, /const expectedLyrics = expectedRecords\.filter\(Boolean\)\.length/);
});
