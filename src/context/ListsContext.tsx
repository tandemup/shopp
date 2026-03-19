import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

import { Item } from "../types/Item";
import { List } from "../types/List";

/* =========================
   CONTEXT TYPE
========================= */

type ListsContextType = {
  lists: List[];

  // Lists
  addList: (name: string) => void;
  deleteList: (id: string) => void;
  archiveList: (id: string) => void;
  getList: (id: string) => List | null;

  // Items
  addItem: (listId: string, item: Item) => void;
  updateItem: (itemId: string, updates: Partial<Item>) => void;
  removeItem: (itemId: string) => void;
  findItemById: (id: string) => { item: Item; list: List } | null;

  // Stores
  assignStoreToList: (listId: string, storeId: string) => void;
};

/* =========================
   CONTEXT
========================= */

const ListsContext = createContext<ListsContextType | null>(null);

/* =========================
   PROVIDER
========================= */

export function ListsProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<List[]>([]);

  /* =========================
     LIST OPERATIONS
  ========================= */

  const addList = (name: string) => {
    const newList: List = {
      id: Date.now().toString(),
      name,
      items: [],
    };
    setLists((prev) => [...prev, newList]);
  };

  const deleteList = (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  const archiveList = (id: string) => {
    setLists((prev) =>
      prev.map((l) => (l.id === id ? { ...l, archived: true } : l)),
    );
  };

  const getList = useCallback(
    (id: string) => {
      return lists.find((l) => l.id === id) || null;
    },
    [lists],
  );

  /* =========================
     ITEM OPERATIONS
  ========================= */

  const addItem = (listId: string, item: Item) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, items: [...l.items, item] } : l,
      ),
    );
  };

  const updateItem = (itemId: string, updates: Partial<Item>) => {
    setLists((prev) =>
      prev.map((list) => {
        const hasItem = list.items.some((i) => i.id === itemId);

        if (!hasItem) return list;

        return {
          ...list,
          items: list.items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item,
          ),
        };
      }),
    );
  };

  const removeItem = (itemId: string) => {
    setLists((prev) =>
      prev.map((list) => ({
        ...list,
        items: list.items.filter((item) => item.id !== itemId),
      })),
    );
  };

  const findItemById = useCallback(
    (id: string) => {
      for (const list of lists) {
        const item = list.items.find((i) => i.id === id);
        if (item) {
          return { item, list };
        }
      }
      return null;
    },
    [lists],
  );

  /* =========================
     STORE OPERATIONS
  ========================= */

  const assignStoreToList = (listId: string, storeId: string) => {
    setLists((prev) =>
      prev.map((list) => (list.id === listId ? { ...list, storeId } : list)),
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
        getList,

        // Items
        addItem,
        updateItem,
        removeItem,
        findItemById,

        // Stores
        assignStoreToList,
      }}
    >
      {children}
    </ListsContext.Provider>
  );
}

/* =========================
   HOOK
========================= */

export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) {
    throw new Error("useLists must be used within ListsProvider");
  }
  return ctx;
}
