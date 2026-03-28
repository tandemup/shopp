import { Promotion } from "@/src/types/Promotion";

export const isSamePromotion = (a?: Promotion, b?: Promotion): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;

  if (a.type !== b.type) return false;

  switch (a.type) {
    case "none":
    case "2x1":
    case "3x2":
      return true;

    case "percent":
    case "discount":
      return a.value === (b as typeof a).value;

    case "multi":
      return a.buy === (b as typeof a).buy && a.pay === (b as typeof a).pay;

    default:
      return false;
  }
};
