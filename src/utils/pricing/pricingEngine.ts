import { Item } from "@/src/types/Item";
import { PriceResult } from "@/src/types/PriceResult";
import { Promotion } from "./Promotion";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateItemPrice(item: Item): PriceResult {
  const qty = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? 0;

  const baseTotal = round(qty * unitPrice);

  const promo: Promotion = item.promo ?? { type: "none" };

  let finalTotal = baseTotal;

  switch (promo.type) {
    case "percent":
      finalTotal = baseTotal * (1 - promo.value / 100);
      break;

    case "multi": {
      const groups = Math.floor(qty / promo.buy);
      const remainder = qty % promo.buy;
      const paidUnits = groups * promo.pay + remainder;
      finalTotal = paidUnits * unitPrice;
      break;
    }

    case "none":
    default:
      finalTotal = baseTotal;
  }

  finalTotal = round(finalTotal);

  return {
    baseTotal,
    finalTotal,
    savings: round(baseTotal - finalTotal),
    effectiveUnitPrice: qty > 0 ? round(finalTotal / qty) : 0,
  };
}
