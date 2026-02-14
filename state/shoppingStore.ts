import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

let storage: any;

if (Platform.OS === "web") {
  storage = createJSONStorage(() => localStorage);
} else {
  const AsyncStorage =
    require("@react-native-async-storage/async-storage").default;

  storage = createJSONStorage(() => AsyncStorage);
}

export interface ShoppingItem {
  id: string;
  name: string;
  completed: boolean;
}

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: number;
  items: ShoppingItem[];
}

interface ShoppingState {
  lists: ShoppingList[];
  addList: (name: string) => void;
  removeList: (id: string) => void;
  addItem: (listId: string, name: string) => void;
  toggleItem: (listId: string, itemId: string) => void;
  removeItem: (listId: string, itemId: string) => void;
}

export const useShoppingStore = create<ShoppingState>()(
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
              items: [],
            },
          ],
        })),

      removeList: (id) =>
        set((state) => ({
          lists: state.lists.filter((list) => list.id !== id),
        })),

      addItem: (listId, name) =>
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  items: [
                    ...list.items,
                    {
                      id: Date.now().toString(),
                      name,
                      completed: false,
                    },
                  ],
                }
              : list,
          ),
        })),

      toggleItem: (listId, itemId) =>
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  items: list.items.map((item) =>
                    item.id === itemId
                      ? { ...item, completed: !item.completed }
                      : item,
                  ),
                }
              : list,
          ),
        })),

      removeItem: (listId, itemId) =>
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  items: list.items.filter((item) => item.id !== itemId),
                }
              : list,
          ),
        })),
    }),
    {
      name: "shopping-storage",
      storage,
    },
  ),
);
