import { Item } from "./Item";

export interface List {
  id: string;
  name: string;
  createdAt: number;
  currency: string;
  items: Item[];
}
