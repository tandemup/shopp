import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CartItem } from "../models/CartItem";
import { Product } from "../models/Product";

type CartState = {
  items: CartItem[];

  addProduct: (product: Product) => void;
  removeProduct: (productId: string) => void;
  clearCart: () => void;

  total: () => number;
};

const createCartStore = (persisted: boolean) =>
  create<CartState>()(
    persisted
      ? persist(
          (set, get) => ({
            items: [],

            addProduct: (product) =>
              set((state) => {
                const existing = state.items.find(
                  (item) => item.product.id === product.id,
                );

                if (existing) {
                  return {
                    items: state.items.map((item) =>
                      item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item,
                    ),
                  };
                }

                return {
                  items: [...state.items, { product, quantity: 1 }],
                };
              }),

            removeProduct: (productId) =>
              set((state) => ({
                items: state.items
                  .map((item) =>
                    item.product.id === productId
                      ? { ...item, quantity: item.quantity - 1 }
                      : item,
                  )
                  .filter((item) => item.quantity > 0),
              })),

            clearCart: () => set({ items: [] }),

            total: () =>
              get().items.reduce(
                (sum, item) => sum + item.product.price * item.quantity,
                0,
              ),
          }),
          {
            name: "expo-shop-cart",
            storage: createJSONStorage(() => window.localStorage),
            partialize: (state) => ({ items: state.items }),
          },
        )
      : (set, get) => ({
          items: [],

          addProduct: (product) =>
            set((state) => {
              const existing = state.items.find(
                (item) => item.product.id === product.id,
              );

              if (existing) {
                return {
                  items: state.items.map((item) =>
                    item.product.id === product.id
                      ? { ...item, quantity: item.quantity + 1 }
                      : item,
                  ),
                };
              }

              return {
                items: [...state.items, { product, quantity: 1 }],
              };
            }),

          removeProduct: (productId) =>
            set((state) => ({
              items: state.items
                .map((item) =>
                  item.product.id === productId
                    ? { ...item, quantity: item.quantity - 1 }
                    : item,
                )
                .filter((item) => item.quantity > 0),
            })),

          clearCart: () => set({ items: [] }),

          total: () =>
            get().items.reduce(
              (sum, item) => sum + item.product.price * item.quantity,
              0,
            ),
        }),
  );

export const useCartStore =
  Platform.OS === "web" ? createCartStore(true) : createCartStore(false);
