type Promotion =
  | { type: "none" }
  | { type: "percent"; value: number }
  | { type: "fixed"; value: number }
  | { type: "multi"; buy: number; pay: number };

type Input = {
  price: number;
  quantity: number;
  promotion: Promotion;
};

type Result = {
  base: number;
  discount: number;
  total: number;
};

export function calculateTotal({ price, quantity, promotion }: Input): Result {
  const base = price * quantity;

  if (!promotion || promotion.type === "none") {
    return { base, discount: 0, total: base };
  }

  let total = base;

  switch (promotion.type) {
    case "percent": {
      const discount = (base * promotion.value) / 100;
      total = base - discount;
      break;
    }

    case "fixed": {
      const discount = promotion.value * quantity;
      total = base - discount;
      break;
    }

    case "multi": {
      const { buy, pay } = promotion;

      const groups = Math.floor(quantity / buy);
      const remainder = quantity % buy;

      const totalUnitsToPay = groups * pay + remainder;

      total = totalUnitsToPay * price;
      break;
    }
  }

  // Evitar negativos
  total = Math.max(0, total);

  return {
    base,
    discount: base - total,
    total,
  };
}
