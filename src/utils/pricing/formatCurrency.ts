export function formatCurrency(value: number, currency = "€") {
  return `${value.toFixed(2)} ${currency}`;
}
