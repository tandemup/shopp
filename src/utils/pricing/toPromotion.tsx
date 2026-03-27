import { Promotion } from "@/src/types/Promotion";

export const toPromotion = (id?: string): Promotion => {
  switch (id) {
    case "2x1":
      return { type: "multi", buy: 2, pay: 1 };

    case "3x2":
      return { type: "multi", buy: 3, pay: 2 };

    case "-10%":
      return { type: "percent", value: 10 };

    case "-20%":
      return { type: "percent", value: 20 };

    default:
      return { type: "none" };
  }
};
