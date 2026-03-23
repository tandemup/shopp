import React, { createContext, useContext, useState } from "react";

import { Item } from "@/src/types/Item";
import { List } from "@/src/types/list";
import { Promotions } from "@/src/types/Promotion";
import { generateId } from "@/src/utils/generateId";

type ListsContextType = {
  lists: List[];

  addList: (name: string) => void;
  deleteList: (id: string) => void;
  archiveList: (id: string) => void;
  updateList: (id: string, name: string) => void;
  getList: (id: string) => List | null;

  addItem: (listId: string, item: Partial<Item>) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<Item>) => void;
  removeItem: (listId: string, itemId: string) => void;
  toggleItem: (listId: string, itemId: string) => void;

  findItemById: (itemId: string) => { list: List; item: Item } | null;

  assignStoreToList: (listId: string, storeId: string) => void;
};

const ListsContext = createContext<ListsContextType | null>(null);

export const ListsProvider = ({ children }: { children: React.ReactNode }) => {
  const [lists, setLists] = useState<List[]>([]);

  const addList = (name: string) => {
    const newList: List = {
      id: generateId(),
      name,
      createdAt: Date.now(),
      currency: "EUR",
      items: [],
    };

    setLists((prev) => [newList, ...prev]);
  };

  const deleteList = (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  const archiveList = (id: string) => {
    setLists((prev) =>
      prev.map((l) => (l.id === id ? { ...l, archived: true } : l)),
    );
  };

  const updateList = (id: string, name: string) => {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
  };

  const getList = (id: string): List | null => {
    return lists.find((l) => l.id === id) || null;
  };

  const addItem = (listId: string, item: Partial<Item>) => {
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;

        const newItem: Item = {
          id: generateId(),
          name: item.name ?? "Nuevo producto",
          quantity: item.quantity ?? 1,
          unit: item.unit ?? "u",
          unitPrice: item.unitPrice ?? 0,
          checked: item.checked ?? true,
          promo: item.promo ?? Promotions.none(),
          barcode: item.barcode ?? "",
        };

        return {
          ...list,
          items: [newItem, ...list.items],
        };
      }),
    );
  };

  const updateItem = (
    listId: string,
    itemId: string,
    updates: Partial<Item>,
  ) => {
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;

        return {
          ...list,
          items: list.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  ...updates,
                }
              : item,
          ),
        };
      }),
    );
  };

  const removeItem = (listId: string, itemId: string) => {
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;

        return {
          ...list,
          items: list.items.filter((i) => i.id !== itemId),
        };
      }),
    );
  };

  const toggleItem = (listId: string, itemId: string) => {
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;

        return {
          ...list,
          items: list.items.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item,
          ),
        };
      }),
    );
  };

  const findItemById = (itemId: string) => {
    for (const list of lists) {
      const item = list.items.find((i) => i.id === itemId);
      if (item) return { list, item };
    }
    return null;
  };

  const assignStoreToList = (listId: string, storeId: string) => {
    setLists((prev) =>
      prev.map((list) => (list.id === listId ? { ...list, storeId } : list)),
    );
  };

  return (
    <ListsContext.Provider
      value={{
        lists,
        addList,
        deleteList,
        archiveList,
        updateList,
        getList,
        addItem,
        updateItem,
        removeItem,
        toggleItem,
        findItemById,
        assignStoreToList,
      }}
    >
      {children}
    </ListsContext.Provider>
  );
};

export const useLists = () => {
  const ctx = useContext(ListsContext);

  if (!ctx) {
    throw new Error("useLists must be used within ListsProvider");
  }

  return ctx;
};
