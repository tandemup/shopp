import React, { createContext, useContext, useState } from "react";
import { Store } from "../types/Store";

type StoresContextType = {
  stores: Store[];
  addStore: (store: Store) => void;
};

const StoresContext = createContext<StoresContextType | null>(null);

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);

  const addStore = (store: Store) => {
    setStores((prev) => [...prev, store]);
  };

  return (
    <StoresContext.Provider value={{ stores, addStore }}>
      {children}
    </StoresContext.Provider>
  );
}

export function useStores() {
  const ctx = useContext(StoresContext);
  if (!ctx) throw new Error("useStores must be used inside StoresProvider");
  return ctx;
}
