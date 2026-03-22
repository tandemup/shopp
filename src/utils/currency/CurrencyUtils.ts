export function getCurrency(code: string = "EUR") {
  switch (code) {
    case "USD":
      return "$";
    case "GBP":
      return "£";
    case "EUR":
    default:
      return "€";
  }
}
