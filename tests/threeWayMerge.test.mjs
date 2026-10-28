import assert from 'node:assert/strict';
import {planThreeWayMusicMerge as plan} from './threeWayMerge.mjs';
const t=(id,title=id)=>({id,title});
const pack=(tracks,rest={},lyrics=[])=>({snapshot:{id:'music1',collectionType:'playlist',title:'Test',tracks,...rest},lyrics});
const base=pack([t('a'),t('b')]);
const tests=[
  ['sin cambios',()=>{const p=plan({base,local:base,remote:base});assert.equal(p.conflicts.length,0);assert.equal(p.canApply,false)}],
  ['cambio local y remoto en pistas distintas',()=>{const p=plan({base,local:pack([t('a','A local'),t('b')]),remote:pack([t('a'),t('b','B remote')])});assert.equal(p.conflicts.length,0);assert.deepEqual(p.proposal.snapshot.tracks.map(x=>x.title),['A local','B remote'])}],
  ['conflicto misma pista',()=>{const p=plan({base,local:pack([t('a','local'),t('b')]),remote:pack([t('a','remote'),t('b')])});assert.ok(p.conflicts.some(x=>x.path==='tracks.a.title'))}],
  ['eliminacion frente a edicion',()=>{const p=plan({base,local:pack([t('b')]),remote:pack([t('a','edited'),t('b')])});assert.ok(p.conflicts.some(x=>x.path==='tracks.a'))}],
  ['edicion LRC concurrente',()=>{const l=(text)=>[{key:'lrc-a',record:{text,fileName:'a.lrc'}}];const p=plan({base:pack([t('a')],{},l('original')),local:pack([t('a')],{},l('local')),remote:pack([t('a')],{},l('remote'))});assert.ok(p.conflicts.some(x=>x.path==='lyrics.lrc-a.record.text'))}],
  ['conflicto de orden',()=>{const b=pack([t('a'),t('b'),t('c')]);const p=plan({base:b,local:pack([t('b'),t('a'),t('c')]),remote:pack([t('a'),t('c'),t('b')])});assert.ok(p.conflicts.some(x=>x.path==='tracks.order'))}],
  ['identificadores duplicados',()=>{assert.throws(()=>plan({base,local:pack([t('a'),t('a')]),remote:base}),/duplicadas/)}],
  ['sin base',()=>assert.throws(()=>plan({local:base,remote:base}),/base/)],
  ['solo remoto añade canción',()=>{const p=plan({base,local:base,remote:pack([t('a'),t('b'),t('c')])});assert.equal(p.conflicts.length,0);assert.equal(p.proposal.snapshot.tracks.length,3)}],
];
for (const [name,fn] of tests){fn();process.stdout.write(`OK ${name}\n`)}
console.log(`${tests.length} pruebas superadas`);
