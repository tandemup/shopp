import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const src = await readFile(new URL("../src/screens/playlist/PublicMusicCardScreen.js", import.meta.url), "utf8");
test("QR de canción individual conserva únicamente la pista solicitada", () => {
  assert.match(src, /const visibleTracks = singleSong \? \[tracks\[parsedSong\]\] : tracks/);
  assert.match(src, /tracks: visibleTracks/);
  assert.match(src, /setIndex\(0\)/);
});
test("QR de playlist completa sigue admitiendo todas las pistas", () => {
  assert.match(src, /const singleSong = requestedSong !== null/);
  assert.match(src, /: tracks;/);
});
test("QR no admite índices inexistentes", () => {
  assert.match(src, /singleSong && parsedSong >= tracks.length/);
});
