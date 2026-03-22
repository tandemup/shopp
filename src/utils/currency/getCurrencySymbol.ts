import { CurrencyCode } from "./types";

export function getCurrencySymbol(currency: CurrencyCode = "EUR"): string {
  switch (currency) {
    case "USD":
      return "$";
    case "GBP":
      return "£";
    case "EUR":
    default:
      return "€";
  }
}
