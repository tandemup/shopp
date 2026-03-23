import type { Promotion } from "./Promotion";

export type Item = {
  id: string;
  name: string;
  barcode?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  promo?: Promotion;
  checked?: boolean;
};
