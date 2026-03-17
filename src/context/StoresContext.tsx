import React, { createContext, useContext, useState } from "react";

/* -------------------------------------------------
   Types
-------------------------------------------------- */

export type Store = {
  id: string;
  name: string;
  city?: string;
  isFavorite?: boolean;
};

type StoresContextType = {
  stores: Store[];

  addStore: (store: Store) => void;
  deleteStore: (id: string) => void;

  getStoreById: (id: string) => Store | undefined;

  toggleFavorite: (id: string) => void;
};

/* -------------------------------------------------
   Context
-------------------------------------------------- */

const StoresContext = createContext<StoresContextType | undefined>(undefined);

/* -------------------------------------------------
   Provider
-------------------------------------------------- */

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([
    {
      id: "mercadona-gijon",
      name: "Mercadona",
      city: "Gijón",
      isFavorite: true,
    },
    {
      id: "carrefour-gijon",
      name: "Carrefour",
      city: "Gijón",
    },
  ]);

  /* -------------------------------------------------
     CRUD
  -------------------------------------------------- */

  const addStore = (store: Store) => {
    setStores((prev) => [...prev, store]);
  };

  const deleteStore = (id: string) => {
    setStores((prev) => prev.filter((s) => s.id !== id));
  };

  /* -------------------------------------------------
     Helpers
  -------------------------------------------------- */

  const getStoreById = (id: string) => {
    return stores.find((s) => s.id === id);
  };

  const toggleFavorite = (id: string) => {
    setStores((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s)),
    );
  };

  /* -------------------------------------------------
     Value
  -------------------------------------------------- */

  return (
    <StoresContext.Provider
      value={{
        stores,
        addStore,
        deleteStore,
        getStoreById,
        toggleFavorite,
      }}
    >
      {children}
    </StoresContext.Provider>
  );
}

/* -------------------------------------------------
   Hook
-------------------------------------------------- */

export function useStores() {
  const context = useContext(StoresContext);

  if (!context) {
    throw new Error("useStores must be used within a StoresProvider");
  }

  return context;
}
