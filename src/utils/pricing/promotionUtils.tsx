import { Promotion } from "@/src/types/Promotion";

/* =========================================================
   NORMALIZACIÓN
========================================================= */

export function normalizePromotion(promo?: Promotion): Promotion {
  if (!promo) return { type: "none" };

  switch (promo.type) {
    case "2x1":
      return { type: "multi", buy: 2, pay: 1 };

    case "3x2":
      return { type: "multi", buy: 3, pay: 2 };

    default:
      return promo;
  }
}

/* =========================================================
   LABEL PARA UI
========================================================= */

export function getPromotionLabel(promo?: Promotion): string {
  if (!promo || promo.type === "none") return "";

  switch (promo.type) {
    case "2x1":
      return "2x1";
    case "3x2":
      return "3x2";
    case "percent":
      return `-${promo.value}%`;
    case "discount":
      return `-${promo.value}€`;
    case "multi":
      return `${promo.buy}x${promo.pay}`;
    default:
      return "";
  }
}

export function getPromotionColor(promo?: Promotion): string {
  if (!promo || promo.type === "none") return "#999";

  switch (promo.type) {
    case "2x1":
    case "3x2":
    case "multi":
      return "#2ecc71";
    case "percent":
      return "#f39c12";
    case "discount":
      return "#e74c3c";
    default:
      return "#999";
  }
}

export function isPromotionValid(promo?: Promotion): boolean {
  if (!promo) return false;

  switch (promo.type) {
    case "percent":
      return promo.value > 0 && promo.value <= 100;
    case "discount":
      return promo.value > 0;
    case "multi":
      return promo.buy > 0 && promo.pay > 0 && promo.pay <= promo.buy;
    case "2x1":
    case "3x2":
    case "none":
      return true;
    default:
      return false;
  }
}

export function hasPromotion(promo?: Promotion): boolean {
  return !!promo && promo.type !== "none";
}
