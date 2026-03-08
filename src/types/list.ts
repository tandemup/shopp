import type { PriceInfo } from "./pricing";

export type ShoppingListInput = {
  name: string;
  currency?: string;
  storeId?: string | null;
};

export type ShoppingItemInput = {
  name: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  checked?: boolean;
  promo?: string;
  barcode?: string;
  category?: string;
  note?: string;
  priceInfo?: PriceInfo;
};
