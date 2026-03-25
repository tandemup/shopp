import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import storesData from "@/data/stores.json";

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

const STORAGE_KEY = "stores_favorites";

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [initialized, setInitialized] = useState(false);

  /* ---------------------------------------------
     Init stores (una sola vez)
  ---------------------------------------------- */
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Base data
        const baseStores: Store[] = (storesData as Store[]).map((s) => ({
          ...s,
          favorite: false,
        }));

        // 2. Load favorites
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        let favoriteIds: string[] = [];

        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            favoriteIds = parsed;
          }
        }

        // 3. Merge
        const merged = baseStores.map((s) => ({
          ...s,
          favorite: favoriteIds.includes(s.id),
        }));

        setStores(merged);
      } catch (e) {
        console.warn("Error initializing stores", e);
      } finally {
        setInitialized(true);
      }
    };

    init();
  }, []);

  /* ---------------------------------------------
     Persist favorites (solo cuando cambia stores)
  ---------------------------------------------- */
  useEffect(() => {
    if (!initialized) return;

    const save = async () => {
      try {
        const ids = stores.filter((s) => s.favorite).map((s) => s.id);

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      } catch (e) {
        console.warn("Error saving favorites", e);
      }
    };

    save();
  }, [stores, initialized]);

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
