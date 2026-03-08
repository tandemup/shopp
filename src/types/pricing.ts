export type PriceInfo = {
  qty: number;
  unit: string;
  unitPrice: number;
  currency: string;
  promo: string;
  promoLabel: string;
  subtotal: number;
  total: number;
  savings: number;
  summary: string;
  warning?: string | null;
};
