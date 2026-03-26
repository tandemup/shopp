import type { PriceResult } from "@/src/types/PriceResult";
import type { Promotion } from "@/src/types/Promotion";

export function calculateItemPrice(
  quantity: number,
  unitPrice: number,
  promo?: Promotion,
): PriceResult {
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const price = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;

  const baseTotal = qty * price;

  if (!promo || promo.type === "none") {
    return {
      baseTotal,
      total: baseTotal,
      savings: 0,
      valid: true,
    };
  }

  switch (promo.type) {
    case "2x1": {
      if (qty < 2)
        return {
          baseTotal,
          total: baseTotal,
          savings: 0,
          valid: false,
          reason: "Min 2 unidades",
        };

      const payable = Math.ceil(qty / 2);
      const total = payable * price;

      return {
        baseTotal,
        total,
        savings: baseTotal - total,
        valid: true,
      };
    }

    case "3x2": {
      if (qty < 3)
        return {
          baseTotal,
          total: baseTotal,
          savings: 0,
          valid: false,
          reason: "Min 3 unidades",
        };

      const groups = Math.floor(qty / 3);
      const remainder = qty % 3;

      const total = (groups * 2 + remainder) * price;

      return {
        baseTotal,
        total,
        savings: baseTotal - total,
        valid: true,
      };
    }

    case "percent": {
      if (!promo.value || price <= 0)
        return { baseTotal, total: baseTotal, savings: 0, valid: false };

      const total = baseTotal * (1 - promo.value / 100);

      return {
        baseTotal,
        total,
        savings: baseTotal - total,
        valid: true,
      };
    }

    default:
      return {
        baseTotal,
        total: baseTotal,
        savings: 0,
        valid: false,
      };
  }
}
