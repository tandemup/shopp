import assert from 'node:assert/strict';
import {requireMergeBaseline as guard,requireUnchangedRevision as revision} from '../../src/services/musicSync/mergeGuards.mjs';
const identity={accountId:'user-a',playlistId:'p1',collectionType:'playlist'};
const snapshot={id:'p1',collectionType:'playlist',tracks:[]};
const base={...identity,revision:2,snapshot,lyrics:[]};
const remote={revision:3,snapshot,lyrics:[]};
const tests=[
 ()=>assert.equal(guard({identity,base,remote}).expectedRemoteRevision,3),
 ()=>assert.throws(()=>guard({identity,base:null,remote}),/No existe/),
 ()=>assert.throws(()=>guard({identity,base:{...base,accountId:'user-b'},remote}),/no pertenece/),
 ()=>assert.throws(()=>guard({identity,base,remote:{...remote,revision:1}}),/anticuada/),
 ()=>assert.throws(()=>guard({identity,base,remote:{...remote,lyrics:null}}),/incompatible/),
 ()=>assert.throws(()=>guard({identity,base:{...base,snapshot:{...snapshot,id:'other'}},remote}),/incoherente/),
 ()=>assert.equal(revision(3,3),true),
 ()=>assert.throws(()=>revision(3,4),/vuelve a comparar/),
 ()=>assert.throws(()=>revision(0,0),/vuelve a comparar/),
];
tests.forEach((fn,i)=>{fn();console.log('OK',i+1)});console.log(`${tests.length} pruebas superadas`);
