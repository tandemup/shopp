import React, { createContext, useContext, useState } from "react";
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
}

const ListsContext = createContext<ListsContextType | undefined>(undefined);

export function ListsProvider({ children }: { children: React.ReactNode }) {
  const [lists, setLists] = useState<List[]>([]);

  function addList(name: string) {
    const newList: List = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      currency: "EUR",
      items: [],
    };

    setLists((prev) => [...prev, newList]);
  }

  function addItem(listId: string, item: Item) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId ? { ...list, items: [...list.items, item] } : list,
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

  return (
    <ListsContext.Provider
      value={{
        lists,
        addList,
        addItem,
        updateItem,
        removeItem,
        toggleItem,
        getList,
        getItem,
      }}
    >
      {children}
    </ListsContext.Provider>
  );
}

export function useLists() {
  const context = useContext(ListsContext);

  if (!context) {
    throw new Error("useLists must be used inside ListsProvider");
  }

  return context;
}
