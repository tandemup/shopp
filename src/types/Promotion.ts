export type Promotion =
  | { type: "none" }
  | { type: "percent"; value: number }
  | { type: "multi"; buy: number; pay: number };
