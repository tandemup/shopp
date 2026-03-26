import React, { createContext, useContext, useState } from "react";

export type Store = {
  id: string;
  name: string;
  address: string;
  city: string;
  zipcode: string;
  location?: {
    lat: number;
    lng: number;
    source?: string;
  };
  favorite?: boolean;
};

type StoresContextType = {
  stores: Store[];
  favorites: Store[];

  getStoreById: (id: string) => Store | undefined;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
};

const StoresContext = createContext<StoresContextType | undefined>(undefined);

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [initialized, setInitialized] = useState(false);

  /* ---------------------------------------------
     Actions
  ---------------------------------------------- */
  const toggleFavorite = (id: string) => {
    setStores((prev) =>
      prev.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s)),
    );
  };

  const getStoreById = (id: string) => {
    return stores.find((s) => s.id === id);
  };

  const isFavorite = (id: string) => {
    return stores.some((s) => s.id === id && s.favorite);
  };

  /* ---------------------------------------------
     Derived
  ---------------------------------------------- */
  const favorites = stores.filter((s) => s.favorite);

  return (
    <StoresContext.Provider
      value={{
        stores,
        favorites,
        getStoreById,
        isFavorite,
        toggleFavorite,
      }}
    >
      {children}
    </StoresContext.Provider>
  );
}

/* ---------------------------------------------
   Hook
---------------------------------------------- */
export const useStores = () => {
  const ctx = useContext(StoresContext);
  if (!ctx) {
    throw new Error("useStores must be used inside StoresProvider");
  }
  return ctx;
};
