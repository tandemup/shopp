import assert from "node:assert/strict";
import test from "node:test";

import {
  createStoredZip,
  decodeZipText,
  readStoredZip,
} from "../src/utils/zipStore.js";

test("creates and reads a standard stored ZIP", () => {
  const binary = new Uint8Array([0, 1, 2, 127, 255]);
  const zip = createStoredZip([
    { name: "manifest.json", data: '{"version":1}' },
    { name: "images/example.jpeg", data: binary },
  ]);
  const files = readStoredZip(zip);
  assert.equal(decodeZipText(files.get("manifest.json")), '{"version":1}');
  assert.deepEqual(files.get("images/example.jpeg"), binary);
});

test("rejects a ZIP whose contents have been changed", () => {
  const zip = createStoredZip([{ name: "data.json", data: "original" }]);
  const damaged = zip.slice();
  damaged[40] ^= 0xff;
  assert.throws(() => readStoredZip(damaged), /CRC|dañada/);
});
