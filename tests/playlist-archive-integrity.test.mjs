import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const linkSource = await readFile(new URL('../src/services/musicCardLinks.js', import.meta.url), 'utf8');
const links = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(linkSource)}`);
const writer = (await readFile(new URL('../src/services/playlistArchiveZip.js', import.meta.url), 'utf8'))
  .replace(/^import\s+[^;]+;\s*$/gm, '')
  .replace(/export\s+(?=(?:async\s+)?function|const|let)/g, '');
const reader = (await readFile(new URL('../src/services/playlistArchiveImport.js', import.meta.url), 'utf8'))
  .replace(/export\s+(?=(?:async\s+)?function|const|let)/g, '');
const {makePlaylistArchive, crc32} = new Function('Platform','Sharing','buildPublicManifest','publicIdForPlaylist','videoIdFromTrack','youtubePlaylistIdFromTrack', `${writer}\nreturn {makePlaylistArchive,crc32};`)({OS:'web'},{},links.buildPublicManifest,links.publicIdForPlaylist,links.videoIdFromTrack,links.youtubePlaylistIdFromTrack);
const {decodePlaylistArchive} = new Function(`${reader}\nreturn {decodePlaylistArchive};`)();

const backup = {
  app:'Shopp',version:2,type:'shopp-youtube-playlists',backupStatus:'complete',
  lyricsEntries:1,exportedAt:'2026-10-12T00:00:00Z',
  playlists:[{title:'Prueba',collectionType:'playlist',tracks:[
    {title:'Tema',kind:'single',videoId:'ABCDEFGHIJK',lyricsBackup:{text:'[00:01.00]Hola 🎵',fileName:'tema.lrc'}},
  ]}],
};
const zipOf = value => makePlaylistArchive(value).buffer;
const read16 = (a,p) => a[p] | (a[p+1]<<8);
const read32 = (a,p) => (a[p] | a[p+1]<<8 | a[p+2]<<16 | a[p+3]<<24)>>>0;
const write32 = (a,p,n) => {for(let i=0;i<4;i++) a[p+i]=(n >>> (i*8))&255;};
function mutateCompanionKeepValidCRC(archive) {
  const a=archive.slice();
  // playlist.json local header followed by second local header, then central dir.
  let pos=0; const entries=[];
  while (read32(a,pos)===0x04034b50) {
    const nameLen=read16(a,pos+26), extraLen=read16(a,pos+28),len=read32(a,pos+18);
    const name=new TextDecoder().decode(a.subarray(pos+30,pos+30+nameLen));
    entries.push({name,pos,start:pos+30+nameLen+extraLen,len});
    pos += 30+nameLen+extraLen+len;
  }
  const target=entries.find(e=>e.name.startsWith('lyrics/') && e.name.endsWith('.lrc'));
  assert.ok(target);
  // Change one ASCII byte of the extra human-readable .lrc, not the copy
  // within playlist.json. Recalculate CRC correctly to test semantic check.
  a[target.start+13] ^= 1;
  const checksum=crc32(a.subarray(target.start,target.start+target.len));
  write32(a,target.pos+14,checksum);
  let cpos=pos;
  while (read32(a,cpos)===0x02014b50) {
    const n=read16(a,cpos+28), e=read16(a,cpos+30), c=read16(a,cpos+32);
    if (read32(a,cpos+42)===target.pos) write32(a,cpos+16,checksum);
    cpos+=46+n+e+c;
  }
  return a;
}

test('El ZIP de Shopp con acentos/emoji y LRC se exporta y restaura íntegro',()=>{
  const decoded=decodePlaylistArchive(zipOf(backup));
  assert.deepEqual(decoded,backup);
  assert.match(decoded.playlists[0].tracks[0].lyricsBackup.text,/🎵/);
});
test('Se importa también el ZIP de playlists sin LRC',()=>{
  const noLrc={...backup,lyricsEntries:0,playlists:[{...backup.playlists[0],tracks:[{kind:'single',title:'Sin letra',videoId:'ABCDEFGHIJK',lyricsDisabled:true}]}]};
  assert.deepEqual(decodePlaylistArchive(zipOf(noLrc)),noLrc);
});
test('La importación rechaza un ZIP cuyos bytes LRC han cambiado (CRC)',()=>{
  const a=zipOf(backup).slice();
  const marker=new TextEncoder().encode('[00:01.00]Hola');
  let found=[];
  for(let i=0;i<a.length-marker.length;i++){
    if(marker.every((n,j)=>a[i+j]===n)) found.push(i);
  }
  assert.ok(found.length>=2);
  a[found.at(-1)+11]^=1;
  assert.throws(()=>decodePlaylistArchive(a),/CRC|dañado/);
});
test('Se rechazan diferencias LRC/JSON incluso si el ZIP tiene CRC recalculado',()=>{
  assert.throws(()=>decodePlaylistArchive(mutateCompanionKeepValidCRC(zipOf(backup))),/no coincide con playlist.json/);
});
test('Un ZIP cortado (sin directorio central o sin final) no modifica el almacenamiento',()=>{
  const a=zipOf(backup);
  assert.throws(()=>decodePlaylistArchive(a.slice(0,a.length-22)),/directorio central|incompleto|dañado/);
  assert.throws(()=>decodePlaylistArchive(a.slice(0,100)),/incompleto|dañado/);
});
test('Las pistas nuevas sin letra se marcan para no heredar LRC globales', async()=>{
  const code=await readFile(new URL('../src/screens/playlist/PlayListScreen.js',import.meta.url),'utf8');
  assert.match(code,/Nueva pista sin letra:[\s\S]*?lyrics = \{ lyricsDisabled: true \};/);
});


test('Exportar ZIP añade ficha pública y la importación conserva el respaldo',()=>{
  const original = {...backup, type:'shopp-youtube-playlist', playlists:[{...backup.playlists[0], _id:'playlist-123', id:'playlist-123'}]};
  const a=zipOf(original);
  const entries=[];let pos=0;
  while(read32(a,pos)===0x04034b50){
    const n=read16(a,pos+26), len=read32(a,pos+18);
    const name=new TextDecoder().decode(a.subarray(pos+30,pos+30+n));
    const value=new TextDecoder().decode(a.subarray(pos+30+n,pos+30+n+len));
    entries.push({name,value});pos+=30+n+len;
  }
  const expectedId=links.publicIdForPlaylist(original.playlists[0]);
  const pub=entries.find(e=>e.name===`music-cards/${expectedId}.json`);
  assert.ok(pub, 'ficha pública incluida');
  const manifest=JSON.parse(pub.value);
  assert.equal(manifest.tracks[0].videoId,'ABCDEFGHIJK');
  assert.equal(manifest.id,expectedId);
  assert.ok(!pub.value.includes('lyricsBackup'));
  assert.deepEqual(decodePlaylistArchive(a),original);
});


test('Exportación pública incluye LRC de forma separada y la ficha lo referencia',()=>{
  const a=zipOf(backup);
  const entries=[];let pos=0;
  while(read32(a,pos)===0x04034b50){
    const n=read16(a,pos+26), len=read32(a,pos+18);
    const name=new TextDecoder().decode(a.subarray(pos+30,pos+30+n));
    const value=new TextDecoder().decode(a.subarray(pos+30+n,pos+30+n+len));
    entries.push({name,value});pos+=30+n+len;
  }
  const manifest=JSON.parse(entries.find(x=>/^music-cards\/shopp-.*\.json$/.test(x.name)).value);
  const path=manifest.tracks[0].lyricsUrl;
  assert.match(path,/^\/music-cards\/lyrics\/shopp-.*\/001\.lrc$/);
  assert.equal(entries.find(x=>x.name===path.slice(1)).value,backup.playlists[0].tracks[0].lyricsBackup.text);
  assert.ok(!JSON.stringify(manifest).includes('Hola 🎵'));
  assert.deepEqual(decodePlaylistArchive(a),backup);
});
