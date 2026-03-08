export type ProductLearningEntry = {
  normalizedName: string;
  selects: number;
  lastSelect: string;
};

export type PurchaseHistoryItem = {
  id: string;
  name: string;
  normalizedName: string;
  barcode?: string | null;
  storeId?: string | null;
  frequency: number;
  lastPurchasedAt: number;
};
