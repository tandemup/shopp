import itemsData from "@/data/items.json";
import { Item } from "@/src/types/Item";
import { create } from "zustand";

interface ItemsState {
  items: Item[];

  getItem: (id: string) => Item | undefined;
  updateItem: (item: Item) => void;
  removeItem: (id: string) => void;
}

export const useItemsStore = create<ItemsState>((set, get) => ({
  items: itemsData as Item[],

  getItem: (id) => {
    return get().items.find((i) => i.id === id);
  },

  updateItem: (item) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === item.id ? item : i)),
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),
}));
