import storesData from "@/data/stores.json";
import { createContext, useContext, useState } from "react";

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

export function StoresProvider({ children }) {
  const [stores, setStores] = useState<Store[]>(storesData);

  const [currentStore, setCurrentStore] = useState<Store | null>(null);

  function getStoreById(id: string) {
    return stores.find((s) => s.id === id);
  }

  return (
    <StoresContext.Provider
      value={{
        stores,
        currentStore,
        setCurrentStore,
        getStoreById,
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
