import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import storesData from "@/data/stores.json";

export type Store = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  zipcode?: string;
  location?: {
    lat: number;
    lng: number;
  };
  favorite?: boolean;
};

type StoresContextType = {
  stores: Store[];

  // getters
  getStoreById: (id: string) => Store | undefined;
  isFavorite: (id: string) => boolean;

  // actions
  toggleFavorite: (id: string) => void;

  // derived
  favorites: Store[];
  storesSorted: Store[];
};

const StoresContext = createContext<StoresContextType | undefined>(undefined);
const STORAGE_KEY = "stores_favorites";
export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);

  /* ---------------------------------------------
     Init stores
  ---------------------------------------------- */
  useEffect(() => {
    const init = async () => {
      try {
        const baseStores = storesData as unknown as Store[];

        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const favoriteIds: string[] = raw ? JSON.parse(raw) : [];

        const hydrated = baseStores.map((s) => ({
          ...s,
          favorite: favoriteIds.includes(s.id),
        }));

        setStores(hydrated);
      } catch (e) {
        console.warn("Error initializing stores", e);
        setStores(storesData as unknown as Store[]);
      }
    };

    init();
  }, []);
  /* ---------------------------------------------
     Persist favorites
  ---------------------------------------------- */
  const persistFavorites = async (updated: Store[]) => {
    try {
      const favoriteIds = updated.filter((s) => s.favorite).map((s) => s.id);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch (e) {
      console.warn("Error saving favorites", e);
    }
  };

  /* ---------------------------------------------
     Actions
  ---------------------------------------------- */
  const toggleFavorite = (id: string) => {
    setStores((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, favorite: !s.favorite } : s,
      );

      persistFavorites(updated);
      return updated;
    });
  };

  /* ---------------------------------------------
     Getters
  ---------------------------------------------- */
  const getStoreById = (id: string) => {
    return stores.find((s) => s.id === id);
  };

  const isFavorite = (id: string) => {
    return stores.some((s) => s.id === id && s.favorite);
  };

  /* ---------------------------------------------
     Derived
  ---------------------------------------------- */
  const favorites = useMemo(() => stores.filter((s) => s.favorite), [stores]);

  const storesSorted = useMemo(() => {
    return [...stores].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [stores]);

  /* ---------------------------------------------
     Context value
  ---------------------------------------------- */
  const value: StoresContextType = {
    stores,
    getStoreById,
    isFavorite,
    toggleFavorite,
    favorites,
    storesSorted,
  };

  return (
    <StoresContext.Provider value={value}>{children}</StoresContext.Provider>
  );
}

/* ---------------------------------------------
   Hook
---------------------------------------------- */
export function useStores() {
  const ctx = useContext(StoresContext);
  if (!ctx) {
    throw new Error("useStores must be used within StoresProvider");
  }
  return ctx;
}
