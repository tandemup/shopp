import { getCurrency } from "./CurrencyRegistry";

export function formatCurrency(
  value: number,
  currencyCode: string = "EUR",
  options?: {
    compact?: boolean;
  },
): string {
  const currency = getCurrency(currencyCode as any);

  if (options?.compact) {
    return `${value.toFixed(2)} ${currency.symbol}`;
  }

  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
  }).format(value);
}
