import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const src = readFileSync('src/screens/playlist/PublicMusicCardScreen.js','utf8');
assert.match(src, /"pauseVideo"\s*:\s*"playVideo"/);
assert.match(src, /state === 0 && advanceAutomatically/);
assert.match(src, /"onStateChange"/);
assert.match(src, /"pause-circle"/);
assert.match(src, /nextIndex !== index/);
console.log('OK: controles Play/Pause de pistas y avance continuo conservado');
