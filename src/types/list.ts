import { Item } from "./Item";
//import { Currency } from "./Currency";

export interface List {
  id: string;
  name: string;
  createdAt: number;
  items: Item[];
  storeId?: string;
  archived?: boolean;
}
