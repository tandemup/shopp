export type Promotion = "none" | "2x1" | "3x2" | "10%" | "20%" | "second50";

export interface PriceInput {
  quantity: number;
  unitPrice: number;
  promo?: Promotion;
}

export interface PriceResult {
  base: number;
  total: number;
  saving: number;
}

export function calculatePrice({
  quantity,
  unitPrice,
  promo = "none",
}: PriceInput): PriceResult {
  const base = quantity * unitPrice;

  let total = base;
  let saving = 0;

  switch (promo) {
    case "2x1":
      total = base / 2;
      saving = base - total;

      break;

    case "3x2":
      total = base * (2 / 3);
      saving = base - total;

      break;

    case "10%":
      total = base * 0.9;
      saving = base - total;

      break;

    case "20%":
      total = base * 0.8;
      saving = base - total;

      break;

    case "second50":
      const pairs = Math.floor(quantity / 2);

      saving = pairs * unitPrice * 0.5;

      total = base - saving;

      break;
  }

  return {
    base,
    total,
    saving,
  };
}
