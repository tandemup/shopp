import { DEFAULT_CURRENCY } from "@/src/constants/currencies";
import { Item } from "@/src/types/Item";
import { List } from "@/src/types/List";
import { generateId } from "@/src/utils/generateId";
import { ReactNode, createContext, useContext, useState } from "react";
/* =====================================================
   TYPES
===================================================== */

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

/* =====================================================
   CONTEXT
===================================================== */

const ListsContext = createContext<ListsContextType | undefined>(undefined);

/* =====================================================
   PROVIDER
===================================================== */

export function ListsProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<List[]>([]);

  /* =========================
     LISTS
  ========================= */

  const addList = (name: string) => {
    const newList: List = {
      id: generateId("list"),
      name,
      createdAt: Date.now(),
      currency: DEFAULT_CURRENCY,
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
  const updateList = (id: string, updates: Partial<List>) => {
    setLists((prev) =>
      prev.map((list) => (list.id === id ? { ...list, ...updates } : list)),
    );
  };

  const getList = (id: string) => {
    return lists.find((l) => l.id === id) ?? null;
  };

  /* =========================
     ITEMS
  ========================= */

  const addItem = (listId: string, item: Partial<Item>) => {
    const newItem: Item = {
      id: generateId("item"),
      name: item.name ?? "Nuevo producto",
      quantity: item.quantity ?? 1,
      unit: item.unit ?? "u",
      unitPrice: item.unitPrice ?? 0,
      checked: item.checked ?? true,
      promo: item.promo ?? "none",
      ...item,
    };

    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? { ...list, items: [...list.items, newItem] }
          : list,
      ),
    );
  };

  const updateItem = (
    listId: string,
    itemId: string,
    updates: Partial<Item>,
  ) => {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item,
              ),
            }
          : list,
      ),
    );
  };

  const removeItem = (listId: string, itemId: string) => {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.filter((item) => item.id !== itemId),
            }
          : list,
      ),
    );
  };

  const toggleItem = (listId: string, itemId: string) => {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId
                  ? { ...item, checked: !(item.checked ?? true) }
                  : item,
              ),
            }
          : list,
      ),
    );
  };
  /* =========================
     HELPERS
  ========================= */

  const findItemById = (itemId: string) => {
    for (const list of lists) {
      const item = list.items.find((i) => i.id === itemId);
      if (item) return { list, item };
    }
    return null;
  };

  /* =========================
     STORES
  ========================= */

  const assignStoreToList = (listId: string, storeId: string) => {
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, storeId } : l)),
    );
  };

  /* =========================
     PROVIDER VALUE
  ========================= */

  return (
    <ListsContext.Provider
      value={{
        lists,

        // Lists
        addList,
        deleteList,
        archiveList,
        updateList,
        getList,

        // Items
        addItem,
        updateItem,
        removeItem,
        toggleItem,

        // Helpers
        findItemById,

        // Stores
        assignStoreToList,
      }}
    >
      {children}
    </ListsContext.Provider>
  );
}

/* =====================================================
   HOOK
===================================================== */

export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) {
    throw new Error("useLists must be used within ListsProvider");
  }
  return ctx;
}
