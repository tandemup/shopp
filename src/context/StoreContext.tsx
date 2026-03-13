import { Store } from "@/src/types/Store";
import React, { createContext, useContext, useState } from "react";

type StoreContextType = {
  store: Store[];
  addStore: (store: Store) => void;
};

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store[]>([]);

  const addStore = (store: Store) => {
    setStore((prev) => [...prev, store]);
  };

  return (
    <StoreContext.Provider value={{ store, addStore }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStores must be used inside StoresProvider");
  return ctx;
}
