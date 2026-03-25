import type { Promotion } from "@/src/types/Promotion";

export type CurrencyCode = "EUR" | "USD" | "GBP" | string;
export type UnitCode = "u" | "kg" | "g" | "l" | "ml" | string;

export type PriceInfo = {
  qty: number;
  unit: UnitCode;
  unitPrice: number;
  currency: CurrencyCode;

  subtotal: number;
  total: number;
  savings: number;

  promo: Promotion;
  promoLabel: string;
  summary: string;
  warning?: string;
};

export type PricableItem = {
  quantity?: number | null;
  unitPrice?: number | null;
  unit?: UnitCode | null;
  currency?: CurrencyCode | null;
  promo?: Promotion | null;
};

type PromoValidation = {
  valid: boolean;
  warning?: string;
};

const DEFAULT_PROMO: Promotion = { type: "none" };
const DEFAULT_UNIT: UnitCode = "u";
const DEFAULT_CURRENCY: CurrencyCode = "EUR";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(n) ? n : fallback;
}

function toSafeQuantity(value: unknown): number {
  return Math.max(0, toSafeNumber(value, 0));
}

function toSafeUnitPrice(value: unknown): number {
  return Math.max(0, toSafeNumber(value, 0));
}

export function normalizePromotion(promo?: Promotion | null): Promotion {
  if (!promo || typeof promo !== "object" || !("type" in promo)) {
    return DEFAULT_PROMO;
  }

  switch (promo.type) {
    case "none":
      return { type: "none" };

    case "2x1":
      return { type: "2x1" };

    case "3x2":
      return { type: "3x2" };

    case "discount": {
      const value = Math.max(0, toSafeNumber((promo as any).value, 0));
      return { type: "discount", value };
    }

    case "percent": {
      const value = Math.max(0, toSafeNumber((promo as any).value, 0));
      return { type: "percent", value };
    }

    case "multi": {
      const buy = Math.max(0, Math.floor(toSafeNumber((promo as any).buy, 0)));
      const pay = Math.max(0, Math.floor(toSafeNumber((promo as any).pay, 0)));

      if (buy <= 0 || pay <= 0 || pay > buy) {
        return DEFAULT_PROMO;
      }

      return { type: "multi", buy, pay };
    }

    default:
      return DEFAULT_PROMO;
  }
}

export function promotionToLabel(promo?: Promotion | null): string {
  const safePromo = normalizePromotion(promo);

  switch (safePromo.type) {
    case "none":
      return "Sin oferta";
    case "2x1":
      return "2x1";
    case "3x2":
      return "3x2";
    case "discount":
      return `${round2(safePromo.value).toFixed(2)} € descuento`;
    case "percent":
      return `${round2(safePromo.value)}% dto.`;
    case "multi":
      return `${safePromo.buy}x${safePromo.pay}`;
    default:
      return "Sin oferta";
  }
}

export function validatePromotion(
  promo: Promotion | undefined | null,
  quantity: number,
  unitPrice: number,
): PromoValidation {
  const safePromo = normalizePromotion(promo);
  const safeQty = toSafeQuantity(quantity);
  const safeUnitPrice = toSafeUnitPrice(unitPrice);

  switch (safePromo.type) {
    case "none":
      return { valid: true };

    case "2x1":
      if (safeQty < 2) {
        return {
          valid: false,
          warning: "La oferta 2x1 requiere al menos 2 unidades.",
        };
      }
      return { valid: true };

    case "3x2":
      if (safeQty < 3) {
        return {
          valid: false,
          warning: "La oferta 3x2 requiere al menos 3 unidades.",
        };
      }
      return { valid: true };

    case "discount":
      if (safePromo.value <= 0) {
        return { valid: false, warning: "El descuento debe ser mayor que 0." };
      }
      if (safeUnitPrice <= 0) {
        return {
          valid: false,
          warning: "El precio unitario debe ser mayor que 0.",
        };
      }
      return { valid: true };

    case "percent":
      if (safePromo.value <= 0) {
        return { valid: false, warning: "El porcentaje debe ser mayor que 0." };
      }
      return { valid: true };

    case "multi":
      if (
        safePromo.buy <= 0 ||
        safePromo.pay <= 0 ||
        safePromo.pay > safePromo.buy
      ) {
        return { valid: false, warning: "La promoción múltiple no es válida." };
      }
      if (safeQty < safePromo.buy) {
        return {
          valid: false,
          warning: `La oferta ${safePromo.buy}x${safePromo.pay} requiere al menos ${safePromo.buy} unidades.`,
        };
      }
      return { valid: true };

    default:
      return { valid: true };
  }
}

function calculatePromoTotal(
  promo: Promotion,
  quantity: number,
  unitPrice: number,
): number {
  const qty = toSafeQuantity(quantity);
  const price = toSafeUnitPrice(unitPrice);

  switch (promo.type) {
    case "none":
      return qty * price;

    case "2x1": {
      const payableUnits = Math.ceil(qty / 2);
      return payableUnits * price;
    }

    case "3x2": {
      const groups = Math.floor(qty / 3);
      const remainder = qty % 3;
      return (groups * 2 + remainder) * price;
    }

    case "discount": {
      const subtotal = qty * price;
      return Math.max(0, subtotal - promo.value);
    }

    case "percent": {
      const subtotal = qty * price;
      const factor = Math.max(0, 1 - promo.value / 100);
      return subtotal * factor;
    }

    case "multi": {
      const groups = Math.floor(qty / promo.buy);
      const remainder = qty % promo.buy;
      return (groups * promo.pay + remainder) * price;
    }

    default:
      return qty * price;
  }
}

function buildSummary(
  qty: number,
  unitPrice: number,
  subtotal: number,
  total: number,
  promo: Promotion,
): string {
  const label = promotionToLabel(promo);

  if (promo.type === "none") {
    return `${qty} × ${round2(unitPrice).toFixed(2)} = ${round2(subtotal).toFixed(2)}`;
  }

  return `${qty} × ${round2(unitPrice).toFixed(2)} · ${label} · Total ${round2(total).toFixed(2)}`;
}

export function calculateItemPrice(item: PricableItem): PriceInfo {
  const qty = toSafeQuantity(item.quantity ?? 0);
  const unitPrice = toSafeUnitPrice(item.unitPrice ?? 0);
  const unit = (item.unit ?? DEFAULT_UNIT) as UnitCode;
  const currency = (item.currency ?? DEFAULT_CURRENCY) as CurrencyCode;
  const promo = normalizePromotion(item.promo);

  const subtotal = round2(qty * unitPrice);
  const validation = validatePromotion(promo, qty, unitPrice);

  const rawTotal = validation.valid
    ? calculatePromoTotal(promo, qty, unitPrice)
    : subtotal;

  const total = round2(Math.max(0, rawTotal));
  const savings = round2(Math.max(0, subtotal - total));

  return {
    qty,
    unit,
    unitPrice,
    currency,
    subtotal,
    total,
    savings,
    promo,
    promoLabel: promotionToLabel(promo),
    summary: buildSummary(qty, unitPrice, subtotal, total, promo),
    warning: validation.valid ? undefined : validation.warning,
  };
}

export function calculateListTotal(items: PricableItem[] = []): number {
  return round2(
    items.reduce((acc, item) => {
      const priceInfo = calculateItemPrice(item);
      return acc + priceInfo.total;
    }, 0),
  );
}

export function calculateCheckedListTotal<
  T extends PricableItem & { checked?: boolean | null },
>(items: T[] = []): number {
  return round2(
    items.reduce((acc, item) => {
      if (item.checked === false) return acc;
      const priceInfo = calculateItemPrice(item);
      return acc + priceInfo.total;
    }, 0),
  );
}

export class PricingEngine {
  static calculateItemPrice(item: PricableItem): PriceInfo {
    return calculateItemPrice(item);
  }

  static calculateListTotal(items: PricableItem[] = []): number {
    return calculateListTotal(items);
  }

  static calculateCheckedListTotal<
    T extends PricableItem & { checked?: boolean | null },
  >(items: T[] = []): number {
    return calculateCheckedListTotal(items);
  }

  static validatePromotion(
    promo: Promotion | undefined | null,
    quantity: number,
    unitPrice: number,
  ): PromoValidation {
    return validatePromotion(promo, quantity, unitPrice);
  }

  static promotionToLabel(promo?: Promotion | null): string {
    return promotionToLabel(promo);
  }

  static normalizePromotion(promo?: Promotion | null): Promotion {
    return normalizePromotion(promo);
  }
}
