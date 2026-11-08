import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('lists persistence is gated by the hydrated user-scoped storage key', () => {
  const code = read('src/context/ListsContext.js');
  assert.match(code, /const \[loadedStorageKey, setLoadedStorageKey\] = useState\(null\)/);
  assert.match(code, /const isReady = loadedStorageKey === userStorageKey/);
  assert.match(code, /if \(!isReady \|\| loadedStorageKey !== userStorageKey\) return/);
  assert.match(code, /listsRepository\.save\(lists, userStorageKey\)/);
});

test('an obsolete asynchronous load cannot replace the next user data', () => {
  const code = read('src/context/ListsContext.js');
  assert.match(code, /let cancelled = false/);
  assert.match(code, /if \(!cancelled\) \{\s*setLists\(data\);\s*setLoadedStorageKey\(userStorageKey\)/);
  assert.match(code, /cancelled = true/);
});

test('lists remain local and storage errors are handled', () => {
  const code = read('src/context/ListsContext.js');
  assert.match(code, /Promise\.resolve\(listsRepository\.save\(lists, userStorageKey\)\)\.catch/);
  const repository = read('src/api/providers/local/listsRepository.js');
  assert.doesNotMatch(repository, /convex\/react|\bfetch\s*\(/);
});
