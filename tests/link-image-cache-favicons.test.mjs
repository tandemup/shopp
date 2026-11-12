import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../src/utils/linkImageCache.js", import.meta.url), "utf8");

function loadCache({ fetchFn, storage }) {
  const script = source
    .replace(/^import .*;\s*$/gm, "")
    .replace(/^export async function getCachedLinkImageUri/m, "async function getCachedLinkImageUri")
    + "\nthis.getCachedLinkImageUri = getCachedLinkImageUri;";
  const sandbox = {
    Platform: { OS: "web" },
    FileSystem: { cacheDirectory: "/cache/" },
    storage,
    fetch: fetchFn,
    URL,
    Blob,
    Date,
    console,
  };
  runInNewContext(script, sandbox);
  return sandbox.getCachedLinkImageUri;
}

test("Google S2 favicon returns direct URL without fetching or touching IndexedDB", async () => {
  let fetches = 0;
  let reads = 0;
  const getUri = loadCache({
    fetchFn: async () => { fetches += 1; throw new Error("No se debe llamar fetch"); },
    storage: { getFile: async () => { reads += 1; return null; } },
  });
  const url = "https://www.google.com/s2/favicons?domain=instagram.com&sz=64";
  assert.equal(await getUri(url), url);
  assert.equal(fetches, 0);
  assert.equal(reads, 0);
});

test("Other image origins retain web cache behavior", async () => {
  let fetches = 0;
  const getUri = loadCache({
    fetchFn: async () => { fetches += 1; return { ok: false }; },
    storage: { getFile: async () => null },
  });
  const url = "https://example.com/cover.png";
  assert.equal(await getUri(url), url);
  assert.equal(fetches, 1);
});
