import { CurrencyConfig } from "@/src/types/Currency";

export const CURRENCIES: Record<string, CurrencyConfig> = {
  EUR: {
    code: "EUR",
    symbol: "€",
    locale: "es-ES",
  },
  USD: {
    code: "USD",
    symbol: "$",
    locale: "en-US",
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    locale: "en-GB",
  },
};

export const DEFAULT_CURRENCY = "EUR";
