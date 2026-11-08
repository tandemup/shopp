import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

const authScreens = [
  "src/screens/auth/LoginScreen.js", "src/screens/auth/RegisterScreen.js",
  "src/screens/auth/ResetPasswordScreen.js", "src/screens/auth/LogoutButton.js",
  "src/screens/settings/MenuScreen.js", "src/navigation/AppNavigator.js",
];

test("all entry points use Shopp auth action hook, not Convex Auth directly", () => {
  for (const file of authScreens) {
    const code = read(file);
    assert.match(code, /useShoppAuthActions\(/, file);
    assert.doesNotMatch(code, /@convex-dev\/auth\/react|useAuthActions\(/, file);
  }
});

test("navigation delegates session and auth boundaries", () => {
  const code = read("src/navigation/AppNavigator.js");
  assert.match(code, /useShoppAuthSession\(/);
  assert.match(code, /ShoppAuthenticated as Authenticated/);
  assert.match(code, /useCurrentUser\(/);
  assert.doesNotMatch(code, /convex\/react|useConvexAuth\(|api\.users\.current/);
});

test("adapter retains original Convex Auth behavior", () => {
  const code = read("src/api/providers/convex/useAuthBackend.js");
  assert.match(code, /return useAuthActions\(\)/);
  assert.match(code, /return useConvexAuth\(\)/);
  assert.match(read("src/components/auth/ShoppAuthBoundary.js"), /from "convex\/react"/);
});

test("auth contract covers blocked users, admin and feature permissions", () => {
  const code = read("src/api/contracts/auth.js");
  for (const term of ["USER_ROLES", "TESTER", "ACCOUNT_STATUS", "BLOCKED", "normalizeShoppUser", "canAccessFeature", "isAccountBlocked"]) {
    assert.ok(code.includes(term), term);
  }
  assert.match(code, /user\.permissions\?\.\[feature\] === true/);
  assert.match(code, /user\.status === ACCOUNT_STATUS\.BLOCKED/);
});

test("current user hook still preserves loading and skip semantics", () => {
  const code = read("src/hooks/useCurrentUser.js");
  assert.match(code, /enabled \? \{\} : "skip"/);
});
