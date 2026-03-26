import React, { createContext, useContext, useEffect, useState } from "react";

import { Item } from "@/src/types/Item";
import { List } from "@/src/types/List";
import { generateId } from "@/src/utils/generateId";

/* -------------------------------------------------
   Helpers (ANTI-NaN)
-------------------------------------------------- */
const toNumber = (v: any, fallback: number) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/* -------------------------------------------------
   Types
-------------------------------------------------- */
type ListsContextType = {
  lists: List[];

  // Lists
  addList: (name: string) => void;
  deleteList: (id: string) => void;
  archiveList: (id: string) => void;
  updateList: (id: string, updates: Partial<List>) => void;
  getList: (id: string) => List | null;

  // Items
  addItem: (listId: string, item: Partial<Item>) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<Item>) => void;
  removeItem: (listId: string, itemId: string) => void;
  toggleItem: (listId: string, itemId: string) => void;

  // Helpers
  findItemById: (itemId: string) => { list: List; item: Item } | null;

  // Stores
  assignStoreToList: (listId: string, storeId: string) => void;
};

const ListsContext = createContext<ListsContextType | null>(null);

/* -------------------------------------------------
   Provider
-------------------------------------------------- */
export const ListsProvider = ({ children }: { children: React.ReactNode }) => {
  const [lists, setLists] = useState<List[]>([]);

  /* ---------------------------------------------
     LOAD (persistencia)
  ---------------------------------------------- */
  useEffect(() => {
    const load = async () => {
      try {
      } catch (e) {
        console.warn("Error loading lists", e);
      }
    };

    load();
  }, []);

  /* ---------------------------------------------
     Lists
  ---------------------------------------------- */
  const addList = (name: string) => {
    const newList: List = {
      id: generateId(),
      name,
      createdAt: Date.now(),
      currency: "EUR",
      items: [],
      archived: false,
    };

    setLists((prev) => [newList, ...prev]);
  };

  const deleteList = (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  const archiveList = (id: string) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              archived: true,
              archivedAt: Date.now(),
              items: l.items.filter((i) => i.checked),
            }
          : l,
      ),
    );
  };

  const updateList = (id: string, updates: Partial<List>) => {
    setLists((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    );
  };

  const getList = (id: string): List | null => {
    return lists.find((l) => l.id === id) || null;
  };

  /* ---------------------------------------------
     Items
  ---------------------------------------------- */
  const addItem = (listId: string, item: Partial<Item>) => {
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;

        const newItem: Item = {
          id: generateId(),
          name: item.name ?? "Nuevo producto",
          quantity: toNumber(item.quantity, 1),
          unit: item.unit ?? "u",
          unitPrice: toNumber(item.unitPrice, 0),
          checked: item.checked ?? true,
          promoId: item.promoId ?? "none", // 🔑 clave v2
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
                  quantity: toNumber(updates.quantity ?? item.quantity, 1),
                  unitPrice: toNumber(updates.unitPrice ?? item.unitPrice, 0),
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

  /* ---------------------------------------------
     Helpers
  ---------------------------------------------- */
  const findItemById = (itemId: string) => {
    for (const list of lists) {
      const item = list.items.find((i) => i.id === itemId);
      if (item) return { list, item };
    }
    return null;
  };

  /* ---------------------------------------------
     Stores
  ---------------------------------------------- */
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

/* -------------------------------------------------
   Hook
-------------------------------------------------- */
export const useLists = () => {
  const ctx = useContext(ListsContext);

  if (!ctx) {
    throw new Error("useLists must be used within ListsProvider");
  }

  return ctx;
};
