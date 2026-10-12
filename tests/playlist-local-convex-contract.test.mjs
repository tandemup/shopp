// Static architecture gates. These are regression tests, not a measurement of
// Convex usage. The real Dashboard must still be audited on each deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = p => readFile(new URL(`../src/${p}`,import.meta.url),'utf8');

test('Music/Classical web no se suscriben a api.playlists.listMine', async () => {
  const src=await read('screens/playlist/PlayListScreen.js');
  assert.match(src,/const localMode = !isTutorialStyle && Platform\.OS === "web";/);
  assert.match(src,/const remotePlaylists = useQuery\(\s*contentApi\.listMine,\s*clientId && !localMode[\s\S]*?: "skip"/);
  assert.match(src,/convex\.query\(api\.playlists\.listMine/);
  assert.match(src,/const migrateFromConvex = useCallback/);
  assert.match(src,/if \(!localMode \|\| !clientId \|\| migratingConvex \|\| localError\) return;/);
  assert.match(src,/if \(localMode\) \{[\s\S]*?localRepo\.saveWithLyrics\(editingId, localItem, pendingLyrics\)/);
  assert.match(src,/allowRemoteLyrics: !localMode/g);
});

test('Los mensajes P2P usan IndexedDB y el ACK solo tras la restauración',async()=>{
  const src=await read('screens/playlist/P2PPlaylistExchangeScreen.js');
  assert.match(src,/restorePortableP2PPlaylist\(received\.payload\);[\s\S]*?type: "PLAYLIST_V2_ACK"/);
  assert.match(src,/playlistAcksRef\.current\.rejectAll\(\)/);
  assert.match(src,/incomingMessageQueueRef\.current = incomingMessageQueueRef\.current\.then/);
  assert.doesNotMatch(src,/api\.playlists\./);
  assert.match(src,/localRepo\.list\("playlist"\)/);
  assert.match(src,/localRepo\.list\("classical"\)/);
});

test('La exportación local no descarga letras de Convex implícitamente',async()=>{
  const src=await read('services/playlistBackupV2.js');
  assert.match(src,/allowRemoteLyrics = false/);
  assert.match(src,/allowRemoteLyrics && track\.lyricsStorageId/);
  const transfer=await read('services/playlistP2PTransfer.js');
  assert.match(transfer,/allowRemoteLyrics: false/);
  assert.doesNotMatch(transfer,/api\.playlists|convex\.query|convex\.mutation/);
});


test('Importación v1 y diagnóstico web no tocan Convex ni escriben fuera de la transacción',async()=>{
 const ui=await read('screens/playlist/PlayListScreen.js');
 assert.match(ui,/const checkLocalIntegrity = useCallback/);
 assert.match(ui,/localRepo\.auditLocalPlaylists\(collection\)/);
 assert.match(ui,/const prepared = imported\.map\(item =>/);
 assert.match(ui,/localRepo\.importBatch\(collection, prepared, \[\], \{ replace: importMode === "replace" \}\)/);
 assert.doesNotMatch(ui,/localRepo\.create\(\{ \.\.\.playlist, collectionType: collection/);
 const repo=await read('storage/playlists/playlistRepository.web.js');
 assert.match(repo,/export async function auditLocalPlaylists\(type\)/);
 assert.match(repo,/transaction\(\[STORE, LRC\], 'readonly'/);
 assert.doesNotMatch(repo,/convex\.|api\.playlists/);
 for(const source of ['storage/playlists/playlistRepository.web.js',
  'storage/lyricsStorage.web.js','storage/indexedDbStorage.web.js']){
   assert.match(await read(source),/onversionchange = \(\) => .*\.close\(\)/);
 }
});
