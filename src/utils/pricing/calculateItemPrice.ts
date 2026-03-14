export type OfferType = "none" | "2x1" | "3x2" | "10%" | "20%";

export interface PriceResult {
  base: number;
  total: number;
  savings: number;
}

export function calculateItemPrice(item: any): PriceResult {
  const qty = item.quantity ?? 1;
  const price = item.price ?? 0;
  const offer: OfferType = item.offer ?? "none";

  const base = qty * price;

  if (offer === "none") {
    return { base, total: base, savings: 0 };
  }

  /* -------------------------
     3x2
  ------------------------- */

  if (offer === "3x2") {
    // promoción no aplicable
    if (qty < 3) {
      return { base, total: base, savings: 0 };
    }

    const groups = Math.floor(qty / 3);
    const remainder = qty % 3;

    const payableUnits = groups * 2 + remainder;
    const total = payableUnits * price;

    return {
      base,
      total,
      savings: base - total,
    };
  }

  /* -------------------------
     2x1
  ------------------------- */

  if (offer === "2x1") {
    // promoción no aplicable
    if (qty < 2) {
      return { base, total: base, savings: 0 };
    }

    const payableUnits = Math.ceil(qty / 2);
    const total = payableUnits * price;

    return {
      base,
      total,
      savings: base - total,
    };
  }

  /* -------------------------
     descuentos %
  ------------------------- */

  if (offer === "10%") {
    const total = base * 0.9;

    return {
      base,
      total,
      savings: base - total,
    };
  }

  if (offer === "20%") {
    const total = base * 0.8;

    return {
      base,
      total,
      savings: base - total,
    };
  }

  return { base, total: base, savings: 0 };
}
