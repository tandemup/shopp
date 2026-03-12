export interface Item {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  promo?: string;
  barcode?: string;
  checked?: boolean;
}
