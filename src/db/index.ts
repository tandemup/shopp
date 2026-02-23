import { addRxPlugin, createRxDatabase } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { getRxStorageIndexedDB } from "rxdb/plugins/storage-indexeddb";

import { productSchema } from "./schemas/product.schema";

addRxPlugin(RxDBDevModePlugin);

let dbPromise: any;

export const getDatabase = async () => {
  if (!dbPromise) {
    dbPromise = createRxDatabase({
      name: "shoppdb",
      storage: getRxStorageIndexedDB(),
    }).then(async (db) => {
      await db.addCollections({
        products: {
          schema: productSchema,
        },
      });

      return db;
    });
  }

  return dbPromise;
};
