import { Item } from "./item";

import { Currency } from "./currency";

export interface List {
  id: string;
  name: string;
  createdAt: number;
  currency: Currency["code"];
  items: Item[];
  storeId?: string;
  archived?: boolean;
}
