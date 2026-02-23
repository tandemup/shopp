// src/db/index.ts

import { addRxPlugin, createRxDatabase, RxDatabase } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { getRxStorageIndexedDB } from "rxdb/plugins/storage-indexeddb";

import { listSchema } from "./schemas/list.schema";
import { productSchema } from "./schemas/product.schema";

/**
 * Solo en desarrollo
 */
if (__DEV__) {
  addRxPlugin(RxDBDevModePlugin);
}

let dbPromise: Promise<RxDatabase> | null = null;

export const getDatabase = async (): Promise<RxDatabase> => {
  if (!dbPromise) {
    dbPromise = createRxDatabase({
      name: "shoppdb",
      storage: getRxStorageIndexedDB(),
      multiInstance: false,
    }).then(async (db) => {
      await db.addCollections({
        products: {
          schema: productSchema,
        },
        lists: {
          schema: listSchema,
        },
      });

      return db;
    });
  }

  return dbPromise;
};
