import { RxJsonSchema } from "rxdb";

export interface ListItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  checked: boolean;
  price?: number;
}

export interface ListDocType {
  id: string;
  name: string;
  createdAt: number;
  archived: boolean;
  storeId?: string;
  items: ListItem[];
  updatedAt: number;
}

export const listSchema: RxJsonSchema<ListDocType> = {
  title: "shopping list schema",
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
    createdAt: {
      type: "number",
    },
    archived: {
      type: "boolean",
    },
    storeId: {
      type: "string",
    },
    updatedAt: {
      type: "number",
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          name: { type: "string" },
          quantity: { type: "number" },
          checked: { type: "boolean" },
          price: { type: "number" },
        },
        required: ["id", "name", "quantity", "checked"],
      },
    },
  },
  required: ["id", "name", "createdAt", "archived", "items", "updatedAt"],
};
