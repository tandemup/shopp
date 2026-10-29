import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const src = await readFile(new URL('../src/services/musicCardLinks.js',import.meta.url), 'utf8');
const links = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(src)}`);
const pub = 'shopp-8616c90d9f7fda61';
const a = {videoId: 'ABCDEFGHIJK'};
const b = {videoId: '12345678901'};
test('El ID individual permanece al reordenar la playlist', () => {
 const first = [a,b].map(t => links.permanentSongCardId(pub,t));
 assert.equal(first[0], links.permanentSongCardId(pub,[b,a][1]));
 assert.notEqual(first[0], first[1]);
 assert.match(first[0], /^shopp-[a-z0-9-]+-c[0-9a-f]{8}$/);
});
test('El ID individual no depende del título ni del nombre del archivo LRC', () => {
 assert.equal(links.permanentSongCardId(pub,a),links.permanentSongCardId(pub,{...a,title:'Otro nombre',lyricsFileName:'nuevo.lrc'}));
});
test('El QR individual abre su propio manifiesto sin parámetro de posición', () => {
 const url = links.buildPlaylistCardUrl('https://ramworks.netlify.app',links.permanentSongCardId(pub,a),'shopp');
 assert.equal(new URL(url).searchParams.has('song'),false);
 assert.equal(new URL(url).searchParams.get('p'),links.permanentSongCardId(pub,a));
});
