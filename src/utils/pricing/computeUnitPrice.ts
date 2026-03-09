export function computeUnitPrice(price: number, quantity: number) {
  if (quantity === 0) return 0
  return price / quantity
}