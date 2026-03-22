export type Promotion =
  | { type: "none" }
  | { type: "percent"; value: number }
  | { type: "discount"; value: number }
  | { type: "multi"; buy: number; pay: number };

// helpers oficiales
export const Promotions = {
  none: (): Promotion => ({ type: "none" }),

  percent: (value: number): Promotion => ({
    type: "percent",
    value,
  }),

  multi: (buy: number, pay: number): Promotion => ({
    type: "multi",
    buy,
    pay,
  }),

  // shortcuts
  twoByOne: (): Promotion => ({ type: "multi", buy: 2, pay: 1 }),
  threeByTwo: (): Promotion => ({ type: "multi", buy: 3, pay: 2 }),
};
