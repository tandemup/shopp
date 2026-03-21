import { Item } from "@/src/types/item";
import { PriceResult } from "@/src/types/priceResult";

/* -------------------------------------------------
   Types (recomendado)
-------------------------------------------------- */

export type Promotion =
  | { type: "none" }
  | { type: "percent"; value: number } // %
  | { type: "multi"; buy: number; pay: number }; // ej: 2x1 => buy:2 pay:1

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/* -------------------------------------------------
   Core
-------------------------------------------------- */

export function calculateItemPrice(item: Item): PriceResult {
  const qty = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? 0;

  const baseTotal = round(qty * unitPrice);

  const promo = normalizePromotion(item.promo);

  let finalTotal = baseTotal;

  switch (promo.type) {
    /* ---------------------------------------------
       PERCENT
    ---------------------------------------------- */
    case "percent": {
      const discount = promo.value / 100;
      finalTotal = baseTotal * (1 - discount);
      break;
    }

    /* ---------------------------------------------
       MULTI (GENÉRICO: 2x1, 3x2, 5x3...)
    ---------------------------------------------- */
    case "multi": {
      const { buy, pay } = promo;

      if (buy <= 0 || pay <= 0 || pay > buy) {
        finalTotal = baseTotal;
        break;
      }

      const groups = Math.floor(qty / buy);
      const remainder = qty % buy;

      const paidUnits = groups * pay + remainder;

      finalTotal = paidUnits * unitPrice;
      break;
    }

    /* ---------------------------------------------
       NONE
    ---------------------------------------------- */
    case "none":
    default:
      finalTotal = baseTotal;
  }

  finalTotal = round(finalTotal);

  const savings = round(baseTotal - finalTotal);

  return {
    baseTotal,
    finalTotal,
    savings,
    effectiveUnitPrice: qty > 0 ? round(finalTotal / qty) : 0,
  };
}

/* -------------------------------------------------
   Normalización (CLAVE)
-------------------------------------------------- */

function normalizePromotion(promo: any): Promotion {
  if (!promo) return { type: "none" };

  // 🔥 soporta string (tu UI actual)
  if (typeof promo === "string") {
    switch (promo) {
      case "2x1":
        return { type: "multi", buy: 2, pay: 1 };
      case "3x2":
        return { type: "multi", buy: 3, pay: 2 };
      case "10%":
        return { type: "percent", value: 10 };
      case "20%":
        return { type: "percent", value: 20 };
      default:
        return { type: "none" };
    }
  }

  // 🔥 ya estructurado
  if (promo.type === "percent") {
    return promo;
  }

  if (promo.type === "multi") {
    return promo;
  }

  if (promo.type === "2x1") {
    return { type: "multi", buy: 2, pay: 1 };
  }

  if (promo.type === "3x2") {
    return { type: "multi", buy: 3, pay: 2 };
  }

  return { type: "none" };
}
