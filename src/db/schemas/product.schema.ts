import { RxJsonSchema } from "rxdb";

export interface ProductDocType {
  id: string;
  name: string;
  barcode: string;
  lastPrice?: number;
  updatedAt: number;
}

export const productSchema: RxJsonSchema<ProductDocType> = {
  title: "product schema",
  version: 0,
  type: "object",
  primaryKey: "id",
  properties: {
    id: {
      type: "string",
      maxLength: 100,
    },
    name: {
      type: "string",
    },
    barcode: {
      type: "string",
    },
    lastPrice: {
      type: "number",
    },
    updatedAt: {
      type: "number",
    },
  },
  required: ["id", "name", "barcode", "updatedAt"],
};
