export type CurrencyCode = "EUR" | "USD" | "GBP";

export type CurrencyConfig = {
  code: CurrencyCode;
  symbol: string;
  locale: string;
};
