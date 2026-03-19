import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import storesSeed from "@/data/stores.json";

/* -------------------------------------------------
   Types
-------------------------------------------------- */

export type Store = {
  id: string;
  name: string;
  city?: string;
  address?: string;

  isFavorite?: boolean;

  location?: {
    lat: number;
    lng: number;
  };
};

type StoresContextType = {
  stores: Store[];

  // derived
  favoriteStores: Store[];

  // CRUD
  addStore: (store: Store) => void;
  deleteStore: (id: string) => void;
  updateStore: (id: string, updates: Partial<Store>) => void;

  // helpers
  getStoreById: (id: string) => Store | undefined;
  toggleFavoriteStore: (id: string) => void;
  isFavoriteStore: (id: string) => boolean;
};

/* -------------------------------------------------
   Constants
-------------------------------------------------- */

const STORAGE_KEY = "stores:favorites";

/* -------------------------------------------------
   Context
-------------------------------------------------- */

const StoresContext = createContext<StoresContextType | undefined>(undefined);

/* -------------------------------------------------
   Provider
-------------------------------------------------- */

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);

  /* -------------------------------------------------
     INIT (seed + favorites)
  -------------------------------------------------- */

  useEffect(() => {
    const loadStores = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const favoriteIds: string[] = stored ? JSON.parse(stored) : [];

        const hydrated = storesSeed.map((s) => ({
          ...s,
          isFavorite: favoriteIds.includes(s.id),
        }));

        setStores(hydrated);
      } catch (e) {
        console.warn("Error loading stores", e);
        setStores(storesSeed);
      }
    };

    loadStores();
  }, []);

  /* -------------------------------------------------
     PERSIST FAVORITES
  -------------------------------------------------- */

  useEffect(() => {
    const saveFavorites = async () => {
      try {
        const favoriteIds = stores.filter((s) => s.isFavorite).map((s) => s.id);

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds));
      } catch (e) {
        console.warn("Error saving favorites", e);
      }
    };

    if (stores.length) {
      saveFavorites();
    }
  }, [stores]);

  /* -------------------------------------------------
     INDEX (performance)
  -------------------------------------------------- */

  const storeMap = useMemo(() => {
    const map = new Map<string, Store>();
    stores.forEach((s) => map.set(s.id, s));
    return map;
  }, [stores]);

  /* -------------------------------------------------
     DERIVED
  -------------------------------------------------- */

  const favoriteStores = useMemo(() => {
    return stores.filter((s) => s.isFavorite);
  }, [stores]);

  /* -------------------------------------------------
     CRUD
  -------------------------------------------------- */

  const addStore = (store: Store) => {
    setStores((prev) => [
      ...prev,
      {
        ...store,
        isFavorite: store.isFavorite ?? false,
      },
    ]);
  };

  const deleteStore = (id: string) => {
    setStores((prev) => prev.filter((s) => s.id !== id));
  };

  const updateStore = (id: string, updates: Partial<Store>) => {
    setStores((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  };

  /* -------------------------------------------------
     HELPERS
  -------------------------------------------------- */

  const getStoreById = (id: string) => {
    return storeMap.get(id);
  };

  const toggleFavoriteStore = (id: string) => {
    setStores((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, isFavorite: !(s.isFavorite ?? false) } : s,
      ),
    );
  };

  const isFavoriteStore = (id: string) => {
    return storeMap.get(id)?.isFavorite ?? false;
  };

  /* -------------------------------------------------
     VALUE
  -------------------------------------------------- */

  return (
    <StoresContext.Provider
      value={{
        stores,
        favoriteStores,

        addStore,
        deleteStore,
        updateStore,

        getStoreById,
        toggleFavoriteStore,
        isFavoriteStore,
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
