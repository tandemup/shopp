import { create } from "zustand";

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: number;
}

interface ShoppingState {
  lists: ShoppingList[];
  addList: (name: string) => void;
  removeList: (id: string) => void;
}

export const useShoppingStore = create<ShoppingState>((set) => ({
  lists: [],
  addList: (name) =>
    set((state) => ({
      lists: [
        ...state.lists,
        {
          id: Date.now().toString(),
          name,
          createdAt: Date.now(),
        },
      ],
    })),
  removeList: (id) =>
    set((state) => ({
      lists: state.lists.filter((list) => list.id !== id),
    })),
}));
