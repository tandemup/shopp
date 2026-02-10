import { Product } from "../models/Product";

export const PRODUCTS: Product[] = [
  { id: "1", name: "Leche", price: 1.2 },
  { id: "2", name: "Pan", price: 0.9 },
  { id: "3", name: "Huevos", price: 2.5 },
];

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
