import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

test("phase 1A defaults to Convex and fails closed for Node", () => {
  const code = read("src/api/config.js");
  assert.match(code, /configuredProvider \|\| BACKEND_PROVIDERS\.CONVEX/);
  assert.match(code, /if \(isNodeBackend\)/);
  assert.match(code, /aún no está implementado/);
});

test("ListsContext uses a stable current-user hook", () => {
  const context = read("src/context/ListsContext.js");
  const hook = read("src/hooks/useCurrentUser.js");
  assert.match(context, /useCurrentUser\(\{ enabled: !guestMode \}\)/);
  assert.doesNotMatch(context, /useQuery\(api\.users\.current/);
  assert.match(hook, /useQuery\(api\.users\.current, enabled \? \{\} : "skip"\)/);
});

test("App displays a configuration error for unsupported providers", () => {
  const app = read("App.js");
  assert.match(app, /getBackendConfigurationError\(\)/);
  assert.match(app, /backendError \|\| !convex/);
});
