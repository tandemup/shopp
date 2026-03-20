export type Promotion =
  | { type: "none" }
  | { type: "2x1" }
  | { type: "3x2" }
  | { type: "discount"; value: number }
  | { type: "percent"; value: number }
  | { type: "multi"; buy: number; pay: number };
