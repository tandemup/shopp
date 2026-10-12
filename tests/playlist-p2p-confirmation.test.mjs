import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const raw = await readFile(new URL('../src/services/playlistP2PTransfer.js', import.meta.url), 'utf8');
const source = raw.replace(/^import\s+[^;]+;\s*$/gm, '').replace(/export\s+(?=(?:async\s+)?function|const|let)/g,'');
const api = new Function('makePlaylistBackupV2', 'validatePlaylistBackupV2', 'importPlaylistsLocally',
  `${source}\nreturn {sendPortableP2PPlaylist,receivePortableP2PMessage,createPlaylistAckTracker};`
)(
  async (playlists, type) => ({ title: playlists[0].title, tracks: playlists[0].tracks,
    exportedAt: new Date().toISOString(), lyricsEntries: 0, type }),
  payload => [{title:payload.title,tracks:payload.tracks}],
  async () => ({added:1})
);

const playlist = { title:'LRC local', collectionType:'playlist', tracks:[{
  title:'Canción', kind:'single', videoId:'ABCDEFGHIJK',url:'https://youtube.com/watch?v=ABCDEFGHIJK',
}]};

function channel() { return {readyState:'open',bufferedAmount:0}; }

test('El emisor espera a que el receptor confirme el guardado IndexedDB (ACK)', async () => {
  const tracker = api.createPlaylistAckTracker({timeoutMs:1000});
  const messages=[]; let settled=false;
  const send = api.sendPortableP2PPlaylist(channel(),playlist,(_ch,msg)=>{messages.push(msg);},
    {waitForAck:tracker.register}).then(()=>{settled=true;});
  await new Promise(resolve=>setTimeout(resolve,12));
  assert.equal(messages.at(-1).type,'PLAYLIST_V2_END');
  assert.equal(settled,false,'DataChannel.send todavía no confirma la restauración');
  assert.equal(tracker.pendingCount(),1);
  const transferId = messages[0].transferId;
  assert.equal(tracker.accept({type:'PLAYLIST_V2_ACK',transferId,ok:true,status:'saved'}),true);
  await send;
  assert.equal(settled,true);
  assert.equal(tracker.pendingCount(),0);
});

test('Una lista duplicada con ACK se considera entrega confirmada, sin reimportar', async () => {
  const tracker=api.createPlaylistAckTracker({timeoutMs:1000});
  let transferId;
  const sent=api.sendPortableP2PPlaylist(channel(),playlist,(_ch,msg)=>{if(msg.type==='PLAYLIST_V2_START') transferId=msg.transferId;},
    {waitForAck:tracker.register});
  await new Promise(resolve=>setTimeout(resolve,1));
  tracker.accept({type:'PLAYLIST_V2_ACK',transferId,ok:true,status:'duplicate'});
  await sent;
  assert.equal(tracker.pendingCount(),0);
});

test('El receptor informa el fallo IndexedDB mediante NACK', async () => {
  const tracker=api.createPlaylistAckTracker({timeoutMs:1000});
  let transferId;
  const sent=api.sendPortableP2PPlaylist(channel(),playlist,(_ch,msg)=>{if(msg.type==='PLAYLIST_V2_START')transferId=msg.transferId;},
    {waitForAck:tracker.register});
  await new Promise(resolve=>setTimeout(resolve,1));
  tracker.accept({type:'PLAYLIST_V2_ACK',transferId,ok:false,error:'QuotaExceededError'});
  await assert.rejects(sent,/QuotaExceededError/);
  assert.equal(tracker.pendingCount(),0);
});

test('Un receptor sin ACK expira, nunca se notifica como envío guardado',async()=>{
  const tracker=api.createPlaylistAckTracker({timeoutMs:15});
  await assert.rejects(api.sendPortableP2PPlaylist(channel(),playlist,()=>{},
    {waitForAck:tracker.register}),/No llegó confirmación/);
  assert.equal(tracker.pendingCount(),0);
});

test('Al cerrar WebRTC se rechazan inmediatamente todos los ACK pendientes',async()=>{
  const tracker=api.createPlaylistAckTracker({timeoutMs:1000});
  const sent=api.sendPortableP2PPlaylist(channel(),playlist,()=>{},
    {waitForAck:tracker.register});
  await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal(tracker.pendingCount(),1);
  tracker.rejectAll();
  await assert.rejects(sent,/conexión P2P terminó/);
  assert.equal(tracker.pendingCount(),0);
});

test('El ACK de una transferencia desconocida no desbloquea otra transferencia',async()=>{
  const tracker=api.createPlaylistAckTracker({timeoutMs:1000});
  const receipt=tracker.register('real-transfer');
  assert.equal(tracker.accept({type:'PLAYLIST_V2_ACK',transferId:'otro',ok:true,status:'saved'}),false);
  assert.equal(tracker.pendingCount(),1);
  tracker.accept({type:'PLAYLIST_V2_ACK',transferId:'real-transfer',ok:true,status:'saved'});
  assert.deepEqual(await receipt.promise,{status:'saved'});
  assert.equal(tracker.pendingCount(),0);
});
