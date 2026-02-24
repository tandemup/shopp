// src/db/index.ts

import { addRxPlugin, createRxDatabase } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

import { listSchema } from "./schemas/list.schema";
import { productSchema } from "./schemas/product.schema";

if (__DEV__) {
  addRxPlugin(RxDBDevModePlugin);
}

let dbPromise: any;

export const getDatabase = async () => {
  if (!dbPromise) {
    dbPromise = createRxDatabase({
      name: "shoppdb",
      storage: getRxStorageDexie(),
    }).then(async (db) => {
      await db.addCollections({
        products: { schema: productSchema },
        lists: { schema: listSchema },
      });

      return db;
    });
  }

  return dbPromise;
};
