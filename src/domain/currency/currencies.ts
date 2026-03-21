import { Currency } from "@/src/types/currency";

export const currencies: Record<string, Currency> = {
  EUR: {
    code: "EUR",
    symbol: "€",
    decimals: 2,
  },

  USD: {
    code: "USD",
    symbol: "$",
    decimals: 2,
  },

  GBP: {
    code: "GBP",
    symbol: "£",
    decimals: 2,
  },
};
