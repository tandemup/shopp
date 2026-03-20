import { CURRENCIES } from "@/src/constants/currencies";

export const getCurrency = (code?: string) => {
  return CURRENCIES[code ?? "EUR"] ?? CURRENCIES["EUR"];
};
