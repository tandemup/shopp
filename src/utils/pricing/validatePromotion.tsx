import type { Promotion } from "@/src/types/Promotion";

export type ValidationResult = {
  valid: boolean;
  reason?: string;
};

export function validatePromotion(
  promo: Promotion,
  qty: number,
  price: number,
): ValidationResult {
  if (!promo || promo.type === "none") return { valid: true };

  switch (promo.type) {
    case "2x1":
      return qty >= 2 ? { valid: true } : { valid: false, reason: "Min 2" };

    case "3x2":
      return qty >= 3 ? { valid: true } : { valid: false, reason: "Min 3" };

    case "4x3":
      return qty >= 4 ? { valid: true } : { valid: false, reason: "Min 4" };

    case "percent":
    case "discount":
      return price > 0
        ? { valid: true }
        : { valid: false, reason: "Precio inválido" };

    case "multi":
      return qty >= promo.buy
        ? { valid: true }
        : { valid: false, reason: `Min ${promo.buy}` };

    default:
      return { valid: true };
  }
}
