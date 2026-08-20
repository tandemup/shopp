import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { loadSourceModule } from "./test-loader.mjs";

const root = resolve(import.meta.dirname, "..");

test("los diálogos web y nativos siguen rutas separadas", async () => {
  const platform = { OS: "web" };
  const nativeCalls = [];
  const Alert = {
    alert: (...args) => nativeCalls.push(args),
  };
  const dialogEvents = [];
  const dialog = await loadSourceModule(
    resolve(root, "src/components/ui/alert/safeAlert.js"),
    {
      replacements: [
        [
          /import\s+\{\s*Alert,\s*Platform\s*\}\s+from\s+"react-native";\s*/,
          "const { Alert, Platform } = __dialogDeps;",
        ],
      ],
      globals: { __dialogDeps: { Alert, Platform: platform } },
      exports: ["registerWebDialogListener", "safeAlert", "safeMenu"],
    },
  );

  const unregister = dialog.registerWebDialogListener((payload) => {
    dialogEvents.push(payload);
  });

  dialog.safeAlert("Web", "Mensaje", [
    { key: "ok", text: "Aceptar", onPress: () => {} },
  ]);
  assert.equal(dialogEvents.length, 1);
  assert.equal(nativeCalls.length, 0);

  platform.OS = "ios";
  dialog.safeAlert("Nativo", "Mensaje", [
    { key: "ok", text: "Aceptar", onPress: () => {} },
  ]);
  assert.equal(dialogEvents.length, 1);
  assert.equal(nativeCalls.length, 1);
  assert.equal(nativeCalls[0][0], "Nativo");

  unregister();
});
