export type Currency = "EUR" | "USD" | "GBP";

export type CurrencyConfig = {
  code: Currency;
  symbol: string;
  locale: string;
};
