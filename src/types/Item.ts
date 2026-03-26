export type Item = {
  id: string;
  name: string;
  barcode?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  promoId: string;
  checked?: boolean;
};
