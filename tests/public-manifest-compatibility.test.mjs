import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/services/musicCardLinks.js", import.meta.url), "utf8");
const links = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
const playlist = { id: "playlist-example", title: "Mis 80", tracks: [
  { title: "Uno", videoId: "ABCDEFGHIJK" },
  { title: "Dos", videoId: "12345678901" }
] };
const id = links.publicIdForPlaylist(playlist);
const expected = links.buildPublicManifest(playlist, id);
test("QR estable para la misma playlist tras editar canciones", () => {
  assert.equal(links.publicIdForPlaylist({...playlist, tracks:[...playlist.tracks].reverse()}), id);
});
test("Acepta LRC y carátulas opcionales en una ficha pública", () => {
  const published = structuredClone(expected);
  published.tracks[0].lyricsUrl = `/music-cards/lyrics/${id}/001.lrc`;
  published.tracks[0].coverUrl = "https://example.com/cover.webp";
  assert.equal(links.comparePublicPlaylist(expected, published).ok, true);
});
test("Detecta canciones cambiadas o reordenadas", () => {
  const published = structuredClone(expected);
  published.tracks.reverse();
  assert.equal(links.comparePublicPlaylist(expected, published).ok, false);
});
test("Rechaza identificador diferente", () => {
  assert.equal(links.comparePublicPlaylist(expected, {...expected, id:"shopp-otro-id"}).ok,false);
});
