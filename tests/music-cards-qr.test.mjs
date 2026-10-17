import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serviceSource = await readFile(new URL('../src/services/musicCardLinks.js',import.meta.url), 'utf8');
const links = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(serviceSource)}`);
const base='https://test-shopp.netlify.app';
const vid1='ABCDEFGHIJK',vid2='12345678901';

test('QR directo YouTube usa sólo IDs válidos',()=>{
  const url=links.buildSongCardUrl(base,{url:`https://youtu.be/${vid1}`},'Pista','Artista','youtube');
  assert.equal(url,`https://www.youtube.com/watch?v=${vid1}`);
  assert.equal(links.videoIdFromTrack({url:'https://evil.example/watch?v=ABCDEFGHIJK'}),'');
  assert.equal(links.videoIdFromTrack({url:'javascript:alert(1)'}),'');
});
test('QR público conserva vídeo, título y artista, no revela LRC',()=>{
  const url=links.buildSongCardUrl(base,{videoId:vid1,lyrics:{text:'privado'}},'Woman','John Lennon');
  assert.ok(url.startsWith(`${base}/music-card.html?card=1`));
  const q=new URL(url).searchParams;
  assert.equal(q.get('v'),vid1);assert.equal(q.get('t'),'Woman');assert.equal(q.get('a'),'John Lennon');
  assert.ok(!url.includes('privado'));
});
test('Pueden abrirse las canciones directamente en reproductor público Shopp',()=>{
  const url=links.buildSongCardUrl(base,{videoId:vid1},'Título','Autor','shopp');
  assert.equal(new URL(url).searchParams.get('shoppCard'),'1');
});
test('Playlist publicada utiliza URL corta con identificador verificable',()=>{
  const id='shopp-abc12345';
  assert.equal(links.buildPlaylistCardUrl(base,id),`${base}/music-card.html?card=1&p=${id}`);
  assert.equal(links.getPublicManifestUrl(base,id),`${base}/music-cards/${id}.json`);
  assert.equal(links.buildPlaylistCardUrl(base,'../bad'), '');
});
test('Ficha publica contiene sólo campos públicos y separa Classical',()=>{
  const playlist={title:'Concierto',composer:'Mozart',owner:'user-secret',email:'private@example.com',_id:'internal',
    tracks:[{title:'Tema 1',videoId:vid1,lyricsBackup:{text:'privado'}},{title:'Tema 2',url:`https://www.youtube.com/watch?v=${vid2}`},{title:'Invalido',url:'https://foo.example'}]};
  const manifest=links.buildPublicManifest(playlist,'shopp-abc12345',true);
  assert.equal(manifest.collectionType,'classical');assert.equal(manifest.tracks.length,2);
  const json=JSON.stringify(manifest);
  assert.ok(!json.includes('user-secret'));assert.ok(!json.includes('private@example.com'));
  assert.ok(!json.includes('privado'));assert.ok(!json.includes('internal'));
});
test('No crea QR web desde URL HTTP remota insegura',()=>{
  assert.equal(links.buildSongCardUrl('http://public.example',{videoId:vid1}),'');
});
test('Vista de impresión contiene 10 canciones diferentes con códigos diferentes', async()=>{
  const printSource=await readFile(new URL('../src/screens/playlist/PrintMusicCardScreen.js',import.meta.url),'utf8');
  const start=printSource.indexOf('function buildPrintHtml('),end=printSource.indexOf('export default function PrintMusicCardScreen()');
  const fn=new Function('qrUrl','esc',printSource.slice(start,end)+'return buildPrintHtml;')(
    u=>`https://quickchart.io/qr?text=${encodeURIComponent(u)}`,
    v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  );
  const cards=Array.from({length:10},(_,i)=>({title:`Tema ${i+1}`,author:'Artista',cover:'',url:`https://example.org/c/${i+1}`}));
  const html=fn({title:'Lista',subtitle:'',cards,distinctCards:true,format:'a4',copies:10,doubleSided:true,duplexFlip:'long',cropMarks:false,contactEmail:'',landingUrl:''});
  assert.equal((html.match(/class="sheet/g)||[]).length,2);
  assert.equal((html.match(/Código QR musical/g)||[]).length,10);
  for(let i=1;i<=10;i++) assert.match(html,new RegExp(`Tema ${i}(?!\\d)`));
  assert.ok(!html.includes('Tema 11'));
});
test('Tamaño tarjeta individual renderiza sólo una tarjeta por cara',async()=>{
  const printSource=await readFile(new URL('../src/screens/playlist/PrintMusicCardScreen.js',import.meta.url),'utf8');
  const start=printSource.indexOf('function buildPrintHtml('),end=printSource.indexOf('export default function PrintMusicCardScreen()');
  const fn=new Function('qrUrl','esc',printSource.slice(start,end)+'return buildPrintHtml;')(
    v=>v,v=>String(v).replace(/&/g,'&amp;'));
  const html=fn({title:'T',subtitle:'',cards:[{title:'S',url:'https://a.example'}],distinctCards:false,format:'card',copies:10,doubleSided:true,duplexFlip:'long',cropMarks:false,contactEmail:'',landingUrl:''});
  assert.equal((html.match(/class="card-wrap"/g)||[]).length,2);
});

test('Carátulas públicas opcionales: HTTPS o ruta pública; nunca datos locales',()=>{
  assert.equal(links.publicCoverUrl('data:image/png;base64,SGVsbG8='),'');
  assert.equal(links.publicCoverUrl('blob:https://test-shopp.netlify.app/id'),'');
  assert.equal(links.publicCoverUrl('file:///private/covers/a.png'),'');
  assert.equal(links.publicCoverUrl('/../secret.png'),'');
  assert.equal(links.publicCoverUrl('https://example.org/cover.webp'),'https://example.org/cover.webp');
  const p={tracks:[{videoId:vid1,title:'Voyager',coverUrl:'https://example.org/cover.webp'},{videoId:vid2,coverUrl:'data:image/png;base64,AAAA'}]};
  const m=links.buildPublicManifest(p,'shopp-abc12345');
  assert.equal(m.version,1);
  assert.equal(m.tracks[0].coverUrl,'https://example.org/cover.webp');
  assert.equal(m.tracks[1].coverUrl,undefined);
});

test('El QR directo conserva título y autor para el reproductor público', async()=>{
 const screen=await readFile(new URL('../src/screens/playlist/PublicMusicCardScreen.js',import.meta.url),'utf8');
 assert.match(screen,/normalizeTrack\(raw \? \{ \.\.\.raw, title, author \} : null\)/);
 assert.match(screen,/contentType\.includes\("json"\)/);
});
