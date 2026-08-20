import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { loadSourceModule } from "./test-loader.mjs";

const root = resolve(import.meta.dirname, "..");

async function loadModel() {
  return await loadSourceModule(resolve(root, "src/utils/scannedProductModel.js"), {
    replacements: [
      [
        /import\s+\{\s*normalizeBarcode\s*\}\s+from\s+"@\/src\/utils\/barcodeNormalization";\s*/,
        "const normalizeBarcode = (value) => String(value || '').replace(/\\D/g, '');",
      ],
    ],
    exports: [
      "normalizeScannedProduct",
      "toScannedProductPatch",
      "getScannedProductGroup",
    ],
  });
}

async function loadHistory(model) {
  const localStorage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => localStorage.get(key) ?? null,
      setItem: (key, value) => localStorage.set(key, String(value)),
      removeItem: (key) => localStorage.delete(key),
    },
  };

  const history = await loadSourceModule(
    resolve(root, "src/services/scannerHistory.js"),
    {
      replacements: [
        [/import\s+\{\s*Platform\s*\}\s+from\s+"react-native";\s*/, "const Platform = { OS: 'web' };"],
        [/import\s+AsyncStorage\s+from\s+"@react-native-async-storage\/async-storage";\s*/, "const AsyncStorage = {};"],
        [/import\s+\{\s*normalizeScannedProduct,?\s*\}\s+from\s+"@\/src\/utils\/scannedProductModel";\s*/, ""],
      ],
      globals: { normalizeScannedProduct: model.normalizeScannedProduct },
      exports: [
        "getScannedHistory",
        "saveScannedHistory",
        "saveScannedEntry",
        "updateScannedEntry",
        "removeScannedItem",
        "clearScannedHistory",
      ],
    },
  );

  return { history, localStorage };
}

async function loadSync(model) {
  return await loadSourceModule(resolve(root, "src/services/scannedHistorySync.js"), {
    replacements: [
      [
        /import\s+\{[\s\S]*?\}\s+from\s+"@\/src\/utils\/scannedProductModel";\s*/,
        "",
      ],
    ],
    globals: {
      normalizeScannedProduct: model.normalizeScannedProduct,
      toScannedProductPatch: model.toScannedProductPatch,
    },
    exports: ["mergeScannedHistory", "synchronizeScannedHistory", "migrateLocalScannedHistory"],
  });
}

test("flujo completo: escanear, guardar, editar, cancelar, sincronizar, recuperar y eliminar", async () => {
  const model = await loadModel();
  const { history, localStorage } = await loadHistory(model);
  const sync = await loadSync(model);

  const scanned = await history.saveScannedEntry(" 8412345678901 ", {
    name: "Producto inicial",
    product_type: "food",
    categoryName: "Bebidas",
    subcategoryName: "Agua",
    image_url: "https://example.test/initial.jpg",
  });

  assert.equal(scanned.barcode, "8412345678901");
  assert.equal(scanned.productType, "Supermercado");
  assert.equal(scanned.category, "Bebidas");
  assert.equal(scanned.subcategory, "Agua");
  assert.equal(scanned.imageUrl, "https://example.test/initial.jpg");

  const beforeCancel = await history.getScannedHistory();
  const draft = { ...beforeCancel[0], name: "Cambio no confirmado" };
  assert.equal(draft.name, "Cambio no confirmado");
  assert.deepEqual(await history.getScannedHistory(), beforeCancel);

  const edited = await history.updateScannedEntry(scanned.barcode, {
    name: "Producto editado",
    productType: "Libros",
    category: "Ensayo",
    subcategory: "Historia",
    imageUrl: "https://example.test/edited.jpg",
  });

  assert.equal(edited.name, "Producto editado");
  assert.equal(edited.productType, "Libros");
  assert.equal(edited.subcategory, "Historia");
  assert.equal(edited.imageUrl, "https://example.test/edited.jpg");

  const uploads = [];
  const migration = await sync.migrateLocalScannedHistory({
    localItems: await history.getScannedHistory(),
    uploadEntry: async (barcode, patch) => uploads.push({ barcode, patch }),
  });

  assert.deepEqual(migration, { uploaded: 1, failed: 0 });
  assert.equal(uploads[0].patch.productType, "Libros");
  assert.equal(uploads[0].patch.category, "Ensayo");
  assert.equal(uploads[0].patch.subcategory, "Historia");
  assert.equal(uploads[0].patch.imageUrl, "https://example.test/edited.jpg");

  const recoveredFromAnotherDevice = {
    barcode: "8001234567890",
    name: "Producto de otro dispositivo",
    productType: "Supermercado",
    category: "Conservas",
    subcategory: "Vegetales",
    imageUrl: "https://example.test/remote.jpg",
    updatedAt: new Date(Date.now() + 1000).toISOString(),
  };
  const nextLocal = await sync.synchronizeScannedHistory({
    localItems: await history.getScannedHistory(),
    remoteItems: [recoveredFromAnotherDevice],
    saveLocalHistory: history.saveScannedHistory,
  });

  assert.equal(nextLocal.length, 2);
  assert.equal(
    nextLocal.find((item) => item.barcode === recoveredFromAnotherDevice.barcode)
      .imageUrl,
    recoveredFromAnotherDevice.imageUrl,
  );
  assert.ok(localStorage.size > 0);

  const afterDelete = await history.removeScannedItem(scanned.barcode);
  assert.equal(afterDelete.some((item) => item.barcode === scanned.barcode), false);
  assert.equal((await history.getScannedHistory()).length, 1);
});
