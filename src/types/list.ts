import { Currency } from "./Currency";
import { Item } from "./Item";

export interface List {
  id: string;
  name: string;
  createdAt: number;
  currency: Currency;
  items: Item[];
  storeId?: string;
  archived?: boolean;
}
