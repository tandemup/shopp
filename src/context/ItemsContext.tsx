import React, { createContext, useContext, useState } from "react"
import { ListItem } from "../models/ListItem"

type ItemsContextType = {
  items: ListItem[]
  addItem: (listId: string, name: string) => void
  toggleItem: (id: string) => void
  removeItem: (id: string) => void
}

const ItemsContext = createContext<ItemsContextType | null>(null)

export function ItemsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ListItem[]>([])

  const addItem = (listId: string, name: string) => {
    const item: ListItem = {
      id: crypto.randomUUID(),
      listId,
      name,
      quantity: 1,
      checked: false,
    }

    setItems(prev => [...prev, item])
  }

  const toggleItem = (id: string) => {
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, checked: !i.checked } : i))
    )
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <ItemsContext.Provider value={{ items, addItem, toggleItem, removeItem }}>
      {children}
    </ItemsContext.Provider>
  )
}

export function useItems() {
  const ctx = useContext(ItemsContext)
  if (!ctx) throw new Error("useItems must be used inside ItemsProvider")
  return ctx
}