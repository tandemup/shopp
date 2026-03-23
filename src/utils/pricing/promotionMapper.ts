// src/utils/pricing/promotionMapper.ts

import type { Promotion } from "@/src/types/Promotion";

/* -------------------------------------------------
   STRING -> Promotion (UI → engine)
-------------------------------------------------- */
export function toPromotion(id?: string | null): Promotion {
  if (!id || id === "none") {
    return { type: "none" };
  }

  // MULTI (2x1, 3x2, 4x3)
  if (id.includes("x")) {
    const [buy, pay] = id.split("x").map(Number);
    if (!isNaN(buy) && !isNaN(pay)) {
      return { type: "multi", buy, pay };
    }
  }

  // PERCENT (-10%, -20%)
  if (id.endsWith("%")) {
    const value = parseInt(id.replace("%", "").replace("-", ""));
    if (!isNaN(value)) {
      return { type: "percent", value };
    }
  }

  // DISCOUNT (-5€, -10€)
  if (id.includes("€")) {
    const value = parseFloat(id.replace("€", "").replace("-", ""));
    if (!isNaN(value)) {
      return { type: "discount", value };
    }
  }

  return { type: "none" };
}

/* -------------------------------------------------
   Promotion -> STRING (engine → UI)
-------------------------------------------------- */
export function fromPromotion(promo?: Promotion | null): string {
  if (!promo || promo.type === "none") return "none";

  switch (promo.type) {
    case "multi":
      return `${promo.buy}x${promo.pay}`;

    case "percent":
      return `-${promo.value}%`;

    case "discount":
      return `-${promo.value}€`;

    default:
      return "none";
  }
}
