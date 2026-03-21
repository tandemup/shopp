import { CURRENCIES } from "@/src/constants/currencies";
import { Currency } from "@/src/types/currency";

export function formatCurrencyCompact(
  value: number,
  currency: Currency = "EUR",
): string {
  const symbol = CURRENCIES[currency]?.symbol ?? currency;
  return `${value.toFixed(2)} ${symbol}`;
}
