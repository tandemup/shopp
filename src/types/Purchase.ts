export interface Purchase {
  id: string;
  itemId: string;
  price: number;
  quantity: number;
  date: number;
  storeId?: string;
}
