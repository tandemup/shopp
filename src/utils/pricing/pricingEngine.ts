import { Item } from "@/types/Item";

/* -------------------------------------------------
   Result type
-------------------------------------------------- */

export type PriceResult = {
  baseTotal: number;
  finalTotal: number;
  savings: number;
  effectiveUnitPrice: number;
};

/* -------------------------------------------------
   Core engine
-------------------------------------------------- */

export function calculateItemPrice(item: Item): PriceResult {
  const qty = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? 0;

  const baseTotal = qty * unitPrice;

  // 👉 sin promo
  if (!item.promo) {
    return {
      baseTotal,
      finalTotal: baseTotal,
      savings: 0,
      effectiveUnitPrice: unitPrice,
    };
  }

  switch (item.promo.type) {
    /* ---------------------------------------------
       PERCENT DISCOUNT
    ---------------------------------------------- */
    case "percent": {
      const discount = item.promo.value / 100;

      const finalTotal = baseTotal * (1 - discount);
      const savings = baseTotal - finalTotal;

      return {
        baseTotal,
        finalTotal,
        savings,
        effectiveUnitPrice: finalTotal / qty,
      };
    }

    /* ---------------------------------------------
       MULTI (2x1, 3x2...)
    ---------------------------------------------- */
    case "multi": {
      const { buy, pay } = item.promo;

      if (buy <= 0 || pay <= 0 || pay > buy) {
        // fallback defensivo
        return {
          baseTotal,
          finalTotal: baseTotal,
          savings: 0,
          effectiveUnitPrice: unitPrice,
        };
      }

      const groups = Math.floor(qty / buy);
      const remainder = qty % buy;

      const totalPaidUnits = groups * pay + remainder;

      const finalTotal = totalPaidUnits * unitPrice;
      const savings = baseTotal - finalTotal;

      return {
        baseTotal,
        finalTotal,
        savings,
        effectiveUnitPrice: finalTotal / qty,
      };
    }

    /* ---------------------------------------------
       NONE
    ---------------------------------------------- */
    case "none":
    default:
      return {
        baseTotal,
        finalTotal: baseTotal,
        savings: 0,
        effectiveUnitPrice: unitPrice,
      };
  }
}
