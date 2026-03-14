export type Promotion = "none" | "2x1" | "3x2" | "10%" | "20%";

export interface PricingInput {
  quantity: number;
  unitPrice: number;
  offer?: Promotion;
}

export interface PricingResult {
  base: number;
  total: number;
  savings: number;
  offerApplied: boolean;
  missingForOffer: number;
}

export function calculatePrice({
  quantity,
  unitPrice,
  offer = "none",
}: PricingInput): PricingResult {
  const base = quantity * unitPrice;

  let total = base;
  let savings = 0;
  let missingForOffer = 0;
  let offerApplied = false;

  if (offer === "2x1") {
    const groups = Math.floor(quantity / 2);
    const remainder = quantity % 2;

    total = groups * unitPrice + remainder * unitPrice;
    savings = base - total;
    missingForOffer = quantity % 2 === 0 ? 0 : 1;
    offerApplied = groups > 0;
  }

  if (offer === "3x2") {
    const groups = Math.floor(quantity / 3);
    const remainder = quantity % 3;

    total = groups * (2 * unitPrice) + remainder * unitPrice;
    savings = base - total;
    missingForOffer = remainder === 0 ? 0 : 3 - remainder;
    offerApplied = groups > 0;
  }

  if (offer === "10%") {
    total = base * 0.9;
    savings = base - total;
    offerApplied = true;
  }

  if (offer === "20%") {
    total = base * 0.8;
    savings = base - total;
    offerApplied = true;
  }

  return {
    base,
    total,
    savings,
    offerApplied,
    missingForOffer,
  };
}
