import type { Promotion } from "@/src/types/Promotion";

export type PriceInfo = {
  qty: number;
  unitPrice: number;
  subtotal: number;
  total: number;
  savings: number;
  promo: Promotion;
  promoLabel: string;
  warning?: string;
};

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const num = (v: any, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);

function promoLabel(p: Promotion) {
  switch (p.type) {
    case "2x1":
      return "2x1";
    case "3x2":
      return "3x2";
    case "discount":
      return `${p.value}€ desc`;
    case "percent":
      return `${p.value}%`;
    case "multi":
      return `${p.buy}x${p.pay}`;
    default:
      return "Sin oferta";
  }
}

function applyPromo(p: Promotion, qty: number, price: number) {
  const subtotal = qty * price;

  switch (p.type) {
    case "2x1":
      return Math.ceil(qty / 2) * price;

    case "3x2":
      return (Math.floor(qty / 3) * 2 + (qty % 3)) * price;

    case "discount":
      return Math.max(0, subtotal - num(p.value));

    case "percent":
      return subtotal * (1 - num(p.value) / 100);

    case "multi": {
      const groups = Math.floor(qty / num(p.buy));
      const rest = qty % num(p.buy);
      return (groups * num(p.pay) + rest) * price;
    }

    default:
      return subtotal;
  }
}

export function calculateItemPrice(item: {
  quantity?: number;
  unitPrice?: number;
  promo?: Promotion;
}): PriceInfo {
  const qty = Math.max(0, num(item.quantity, 0));
  const price = Math.max(0, num(item.unitPrice, 0));
  const promo = item.promo ?? { type: "none" };

  const subtotal = round(qty * price);

  let total = subtotal;
  let warning: string | undefined;

  if (promo.type === "2x1" && qty < 2) {
    warning = "2x1 requiere ≥2";
  } else if (promo.type === "3x2" && qty < 3) {
    warning = "3x2 requiere ≥3";
  } else {
    total = round(applyPromo(promo, qty, price));
  }

  const savings = round(subtotal - total);

  return {
    qty,
    unitPrice: price,
    subtotal,
    total,
    savings,
    promo,
    promoLabel: promoLabel(promo),
    warning,
  };
}
