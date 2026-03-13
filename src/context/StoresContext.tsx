import storesData from "@/data/stores.json";
import React, { createContext, useContext, useState } from "react";

type Store = {
  id: string;
  name: string;
  city: string;
  address?: string;
  favorite?: boolean;
};

type StoresContextType = {
  stores: Store[];
  currentStore: Store | null;
  selectStore: (store: Store) => void;
};

const StoresContext = createContext<StoresContextType | undefined>(undefined);

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [currentStore, setCurrentStore] = useState<Store | null>(
    storesData[0] ?? null,
  );

  const selectStore = (store: Store) => {
    setCurrentStore(store);
  };

  return (
    <StoresContext.Provider
      value={{
        stores: storesData,
        currentStore,
        selectStore,
      }}
    >
      {children}
    </StoresContext.Provider>
  );
}

export function useStores() {
  const context = useContext(StoresContext);

  if (!context) {
    throw new Error("useStores must be used within StoresProvider");
  }

  return context;
}
