import { Promotion } from "./Promotion";

export interface Item {
  id: string;
  name: string;

  quantity?: number;
  unitPrice?: number;

  promo?: Promotion;

  checked?: boolean;
}
