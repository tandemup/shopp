import { Item } from "@/src/types/Item";
import { List } from "@/src/types/List";
import React, { createContext, useContext, useState } from "react";

/* ================================
   Utils
================================ */

const generateId = () => Math.random().toString(36).substring(2, 10);

/* ================================
   Types
================================ */

type ListsContextType = {
  lists: List[];

  // Lists
  addList: (name: string) => void;
  deleteList: (id: string) => void;
  archiveList: (id: string) => void;
  updateList: (id: string, name: string) => void;
  getList: (id: string) => List | null;

  // Items
  addItem: (listId: string, item: Partial<Item>) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<Item>) => void;
  removeItem: (listId: string, itemId: string) => void;
  toggleItem: (listId: string, itemId: string) => void;

  // Helpers
  findItemById: (itemId: string) => { list: List; item: Item } | null;

  // Stores (future)
  assignStoreToList: (listId: string, storeId: string) => void;
};

/* ================================
   Context
================================ */

const ListsContext = createContext<ListsContextType | null>(null);

/* ================================
   Provider
================================ */

export const ListsProvider = ({ children }: { children: React.ReactNode }) => {
  const [lists, setLists] = useState<List[]>([]);

  /* ================================
     LISTS
  ================================= */

  const addList = (name: string) => {
    const newList: List = {
      id: generateId(),
      name,
      createdAt: Date.now(),
      currency: "EUR", // 🔥 única fuente por ahora
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

  /* ================================
     ITEMS
  ================================= */

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
          checked: false,
          promo: item.promo ?? "none", // 🔥 clave
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
                  ...updates, // 🔥 merge correcto (NO perder promo)
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

  /* ================================
     HELPERS
  ================================= */

  const findItemById = (itemId: string) => {
    for (const list of lists) {
      const item = list.items.find((i) => i.id === itemId);
      if (item) {
        return { list, item };
      }
    }
    return null;
  };

  /* ================================
     STORES (stub)
  ================================= */

  const assignStoreToList = (listId: string, storeId: string) => {
    setLists((prev) =>
      prev.map((list) => (list.id === listId ? { ...list, storeId } : list)),
    );
  };

  /* ================================
     EXPORT
  ================================= */

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

/* ================================
   Hook
================================ */

export const useLists = () => {
  const ctx = useContext(ListsContext);
  if (!ctx) {
    throw new Error("useLists must be used within ListsProvider");
  }
  return ctx;
};
