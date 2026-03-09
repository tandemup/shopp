import React, { createContext, useContext, useState } from "react"
import { ShoppingList } from "../models/ShoppingList"

type ListsContextType = {
  lists: ShoppingList[]
  createList: (name: string) => void
  archiveList: (id: string) => void
}

const ListsContext = createContext<ListsContextType | null>(null)

export function ListsProvider({ children }: { children: React.ReactNode }) {
  const [lists, setLists] = useState<ShoppingList[]>([])

  const createList = (name: string) => {
    const newList: ShoppingList = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      archived: false,
    }

    setLists(prev => [...prev, newList])
  }

  const archiveList = (id: string) => {
    setLists(prev =>
      prev.map(l => (l.id === id ? { ...l, archived: true } : l))
    )
  }

  return (
    <ListsContext.Provider value={{ lists, createList, archiveList }}>
      {children}
    </ListsContext.Provider>
  )
}

export function useLists() {
  const ctx = useContext(ListsContext)
  if (!ctx) throw new Error("useLists must be used inside ListsProvider")
  return ctx
}