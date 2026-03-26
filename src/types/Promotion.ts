export type Promotion =
  | { type: "none" }
  | { type: "2x1" }
  | { type: "3x2" }
  | { type: "percent"; value: number }
  | { type: "discount"; value: number }
  | { type: "multi"; buy: number; pay: number };

export type PromotionOption = {
  id: string;
  label: string;
} & Promotion;
