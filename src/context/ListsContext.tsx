import itemsData from "@/data/items.json";
import React, { createContext, useContext, useMemo, useState } from "react";
import { Item } from "../types/Item";
import { List } from "../types/List";

interface ListsContextType {
  lists: List[];
  addList: (name: string) => void;
  addItem: (listId: string, item: Item) => void;
  updateItem: (listId: string, item: Item) => void;
  removeItem: (listId: string, itemId: string) => void;
  toggleItem: (listId: string, itemId: string) => void;
  getList: (id: string) => List | undefined;
  getItem: (listId: string, itemId: string) => Item | undefined;
  findItemById: (itemId: string) => { list: List; item: Item } | undefined;
}

const ListsContext = createContext<ListsContextType | undefined>(undefined);

const initialLists: List[] = [
  {
    id: "default-list",
    name: "Lista principal",
    createdAt: Date.now(),
    currency: "EUR",
    items: (itemsData as Item[]).map((item) => ({
      ...item,
      checked: item.checked ?? false,
    })),
  },
];

function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function ListsProvider({ children }: { children: React.ReactNode }) {
  const [lists, setLists] = useState<List[]>(initialLists);

  function addList(name: string) {
    const newList: List = {
      id: buildId("list"),
      name: name.trim() || "Nueva lista",
      createdAt: Date.now(),
      currency: "EUR",
      items: [],
    };

    setLists((prev) => [...prev, newList]);
  }

  function addItem(listId: string, item: Item) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: [...list.items, item],
            }
          : list,
      ),
    );
  }

  function updateItem(listId: string, updatedItem: Item) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === updatedItem.id ? updatedItem : item,
              ),
            }
          : list,
      ),
    );
  }

  function removeItem(listId: string, itemId: string) {
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
  }

  function toggleItem(listId: string, itemId: string) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item,
              ),
            }
          : list,
      ),
    );
  }

  function getList(id: string) {
    return lists.find((list) => list.id === id);
  }

  function getItem(listId: string, itemId: string) {
    const list = lists.find((l) => l.id === listId);
    return list?.items.find((i) => i.id === itemId);
  }

  function findItemById(itemId: string) {
    for (const list of lists) {
      const item = list.items.find((i) => i.id === itemId);
      if (item) {
        return { list, item };
      }
    }
    return undefined;
  }

  const value = useMemo(
    () => ({
      lists,
      addList,
      addItem,
      updateItem,
      removeItem,
      toggleItem,
      getList,
      getItem,
      findItemById,
    }),
    [lists],
  );

  return (
    <ListsContext.Provider value={value}>{children}</ListsContext.Provider>
  );
}

export function useLists() {
  const context = useContext(ListsContext);

  if (!context) {
    throw new Error("useLists must be used inside ListsProvider");
  }

  return context;
}
