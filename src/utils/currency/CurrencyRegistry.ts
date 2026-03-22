import { CURRENCIES } from "@/src/constants/currencies";
import { CurrencyCode, CurrencyConfig } from "./Currency";

export function getCurrency(code?: CurrencyCode): CurrencyConfig {
  return CURRENCIES[code ?? "EUR"] ?? CURRENCIES["EUR"];
}
