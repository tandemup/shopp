import test from 'node:test';
import assert from 'node:assert/strict';
import {applyManualMerge} from '../../src/services/musicSync/phase9Coordinator.mjs';
const identity={accountId:'u',playlistId:'p'};
const local={snapshot:{id:'p'},lyrics:[]},proposal={snapshot:{id:'p',title:'new'},lyrics:[]};
function setup(overrides={}){let events=[];const io={readLocal:async()=>events.includes('installed')?proposal:local,backup:async()=>{events.push('backup');return{id:'b'}},applyLocalCAS:async()=>{events.push('installed')},uploadCAS:async()=>{events.push('uploaded');return{status:'uploaded',revision:3}},readRemote:async()=>({revision:3,...proposal}),saveBase:async()=>{events.push('base')},...overrides};return{events,io};}
const prepared={status:'PREPARED_ONLY',identity,local,proposal,expectedRemoteRevision:2};
test('confirmed end to end with injected IO',async()=>{const {io,events}=setup();assert.equal((await applyManualMerge({prepared,io,confirm:true})).status,'CONFIRMED');assert.deepEqual(events,['backup','installed','uploaded','base'])});
test('requires confirmation',async()=>{const {io}=setup();await assert.rejects(applyManualMerge({prepared,io,confirm:false}),/confirmación/)});
test('blocks changed local before backup',async()=>{const {io,events}=setup({readLocal:async()=>({})});await assert.rejects(applyManualMerge({prepared,io,confirm:true}),/ha cambiado/);assert.deepEqual(events,[])});
test('blocks when backup fails',async()=>{const {io,events}=setup({backup:async()=>null});await assert.rejects(applyManualMerge({prepared,io,confirm:true}),/copia/);assert.deepEqual(events,[])});
test('preserves backup id after remote conflict',async()=>{const {io,events}=setup({uploadCAS:async()=>({status:'conflict',serverRevision:7})});const r=await applyManualMerge({prepared,io,confirm:true});assert.equal(r.status,'PARTIAL_REMOTE_CONFLICT');assert.equal(r.backupId,'b');assert.equal(events.includes('base'),false)});
test('preserves backup id after transport error',async()=>{const {io}=setup({uploadCAS:async()=>{throw Error('offline')}});assert.equal((await applyManualMerge({prepared,io,confirm:true})).status,'PARTIAL_REMOTE_ERROR')});
test('does not confirm mismatched remote payload',async()=>{const {io}=setup({readRemote:async()=>({revision:3,snapshot:{id:'other'},lyrics:[]})});assert.equal((await applyManualMerge({prepared,io,confirm:true})).status,'PENDING_VERIFICATION')});
test('does not confirm if local mutated after sync',async()=>{let i=0;const {io}=setup({readLocal:async()=>++i===1?local:{snapshot:{id:'other'},lyrics:[]}});assert.equal((await applyManualMerge({prepared,io,confirm:true})).status,'PENDING_LOCAL_VERIFICATION')});
test('base failure stays recoverable',async()=>{const {io}=setup({saveBase:async()=>{throw Error('failed')}});assert.equal((await applyManualMerge({prepared,io,confirm:true})).status,'PENDING_RECOVERY')});
