import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("stores context uses backend-independent hooks", () => {
  const code = read("src/context/StoresContext.js");
  assert.match(code, /useStoresData\(\{ enabled: isAdmin \}\)/);
  assert.match(code, /useCurrentUser\(\)/);
  assert.doesNotMatch(code, /convex\/react|_generated\/api/);
  assert.match(code, /importStores,/);
});

test("stores adapter preserves admin-only catalog subscription", () => {
  const code = read("src/api/providers/convex/useStoresBackend.js");
  assert.match(code, /enabled \? \{\} : "skip"/);
  assert.match(code, /listStoresWithMyFavorites/);
  assert.match(code, /toggleMyFavoriteStore/);
  assert.match(code, /upsertStores/);
});

test("stores import and requests screens use Shopp services", () => {
  for (const path of ["src/screens/stores/StoresHomeScreen.js", "src/screens/stores/AdminStoreRequestsScreen.js", "src/screens/stores/StoreCreationRequestScreen.js"]) {
    assert.doesNotMatch(read(path), /convex\/react|_generated\/api/);
  }
  assert.match(read("src/screens/stores/StoresHomeScreen.js"), /importStores\(normalizedStores\)/);
  assert.match(read("src/api/providers/convex/useStoreRequestsBackend.js"), /listEnabled \? \{\} : "skip"/);
});

test("lists context and screen use local repository and current user hook", () => {
  const context = read("src/context/ListsContext.js");
  assert.match(context, /getListsStorageKey\(\{ guestMode, userId: currentUser\?\._id \}\)/);
  assert.match(context, /listsRepository\.load\(userStorageKey\)/);
  assert.match(context, /listsRepository\.save\(next, userStorageKey\)/);
  assert.doesNotMatch(context, /convex\/react|_generated\/api/);
  assert.match(read("src/screens/lists/ShoppingListsScreen.js"), /useCurrentUser\(\{ enabled: !guestMode \}\)/);
  const local = read("src/api/providers/local/listsRepository.js");
  assert.match(local, /guest-local-v1/);
  assert.match(local, /getUserScopedStorageKey/);
  assert.doesNotMatch(local, /convex\/react|fetch\(/);
});
