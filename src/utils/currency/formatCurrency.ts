import { CURRENCIES } from "@/src/constants/currencies";
import { Currency } from "@/src/types/Currency";

export function formatCurrency(
  value: number,
  currency: Currency = "EUR",
): string {
  const config = CURRENCIES[currency];

  if (!config) {
    return `${value.toFixed(2)} ${currency}`;
  }

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
  }).format(value);
}
