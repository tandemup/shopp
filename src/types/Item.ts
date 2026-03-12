export interface Item {
  id: string;
  name: string;
  barcode?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  promo?: string;
  checked?: boolean;
}
