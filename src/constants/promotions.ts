// src/constants/promotions.ts

import type { Promotion } from "@/src/types/Promotion";

export const PROMOTIONS: {
  id: string;
  label: string;
  promo: Promotion;
}[] = [
  { id: "none", label: "Sin oferta", promo: { type: "none" } },
  { id: "2x1", label: "2x1", promo: { type: "2x1" } },
  { id: "3x2", label: "3x2", promo: { type: "3x2" } },
  { id: "discount5", label: "-5€", promo: { type: "discount", value: 5 } },
  { id: "percent10", label: "-10%", promo: { type: "percent", value: 10 } },
];
