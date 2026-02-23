import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
//import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ShoppingList } from "@/src/types/list";

type ShopState = {
  lists: ShoppingList[];
  addList: (name: string) => void;
};

export const useShopStore = create<ShopState>()(
  persist(
    (set) => ({
      lists: [],
      addList: (name) =>
        set((state) => ({
          lists: [
            ...state.lists,
            {
              id: Date.now().toString(),
              name,
              createdAt: Date.now(),
              archived: false,
            },
          ],
        })),
    }),
    {
      name: "shopp-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
