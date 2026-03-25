import type { Promotion } from "@/src/types/Promotion";

export type PromoValidationResult = {
  valid: boolean;
  reason?: string;
};

export function validatePromotion1(
  promo: Promotion,
  qty: number,
  unitPrice: number,
): PromoValidationResult {
  const safeQty = Number.isFinite(qty) ? qty : 0;
  const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
  const subtotal = safeQty * safeUnitPrice;

  switch (promo.type) {
    case "none":
      return { valid: true };

    case "2x1":
      if (safeQty < 2) {
        return { valid: false, reason: "Requiere al menos 2 unidades" };
      }
      return { valid: true };

    case "3x2":
      if (safeQty < 3) {
        return { valid: false, reason: "Requiere al menos 3 unidades" };
      }
      return { valid: true };

    case "multi":
      if (safeQty < promo.buy) {
        return {
          valid: false,
          reason: `Requiere al menos ${promo.buy} unidades`,
        };
      }
      if (promo.pay >= promo.buy) {
        return {
          valid: false,
          reason: "La promoción multi no es válida",
        };
      }
      return { valid: true };

    case "discount":
      if (subtotal <= 0) {
        return { valid: false, reason: "Subtotal no válido" };
      }

      if (promo.value <= 0) {
        return { valid: false, reason: "Descuento no válido" };
      }

      if (promo.value >= subtotal) {
        return {
          valid: false,
          reason: "El descuento no puede ser mayor o igual que el subtotal",
        };
      }

      return { valid: true };
    case "percent":
      if (subtotal <= 0) {
        return { valid: false, reason: "Subtotal no válido" };
      }
      if (promo.value <= 0 || promo.value >= 100) {
        return { valid: false, reason: "Porcentaje no válido" };
      }
      return { valid: true };

    default:
      return { valid: false, reason: "Promoción desconocida" };
  }
}

export function validatePromotion(
  promo: Promotion | undefined,
  quantity: number,
  unitPrice: number,
) {
  // ✅ fallback defensivo
  const safePromo = promo ?? { type: "none" };

  switch (safePromo.type) {
    case "none":
      return { valid: true };

    case "2x1":
      return { valid: quantity >= 2 };

    case "3x2":
      return { valid: quantity >= 3 };

    case "percent":
      return { valid: safePromo.value > 0 };

    default:
      return { valid: true };
  }
}
