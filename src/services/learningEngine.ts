import { Purchase } from "../models/Purchase"
import { Product } from "../models/Product"

export function learnProductsFromPurchases(purchases: Purchase[]): Product[] {
  const map = new Map<string, Product>()

  purchases.forEach(p => {
    if (!map.has(p.name)) {
      map.set(p.name, {
        id: crypto.randomUUID(),
        name: p.name,
      })
    }
  })

  return Array.from(map.values())
}