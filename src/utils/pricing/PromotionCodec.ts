import { Promotion, Promotions } from "./Promotion";

export function toPromotion(id: string): Promotion {
  switch (id) {
    case "2x1":
      return Promotions.twoByOne();

    case "3x2":
      return Promotions.threeByTwo();

    case "discount5":
      return Promotions.percent(5);

    case "discount10":
      return Promotions.percent(10);

    case "discount20":
      return Promotions.percent(20);

    default:
      return Promotions.none();
  }
}

export function fromPromotion(promo: Promotion): string {
  switch (promo.type) {
    case "multi":
      if (promo.buy === 2 && promo.pay === 1) return "2x1";
      if (promo.buy === 3 && promo.pay === 2) return "3x2";
      return `${promo.buy}x${promo.pay}`;

    case "percent":
      return `discount${promo.value}`;

    default:
      return "none";
  }
}
