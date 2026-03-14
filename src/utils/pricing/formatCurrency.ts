export function formatCurrency(value?: number, currency = "€") {
  if (value === undefined || isNaN(value)) return `0.00 ${currency}`;
  return `${value.toFixed(2)} ${currency}`;
}
