import { getCurrencySymbol } from "./getCurrencySymbol";
import { CurrencyCode } from "./types";

type Options = {
  compact?: boolean;
  currency?: CurrencyCode;
  locale?: string;
};

export function formatCurrency(value: number, options?: Options): string {
  const { compact = false, currency = "EUR", locale = "es-ES" } = options || {};

  if (compact) {
    const symbol = getCurrencySymbol(currency);

    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k${symbol}`;
    }

    if (value >= 100) {
      return `${Math.round(value)}${symbol}`;
    }

    return `${value.toFixed(2)}${symbol}`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
}
