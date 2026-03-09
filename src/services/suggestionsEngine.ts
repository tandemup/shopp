import { Product } from "../models/Product"
import { Purchase } from "../models/Purchase"

export function suggestProducts(products: Product[], purchases: Purchase[]) {
  const counts: Record<string, number> = {}

  purchases.forEach(p => {
    counts[p.name] = (counts[p.name] || 0) + 1
  })

  return products.sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0))
}