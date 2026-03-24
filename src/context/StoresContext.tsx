import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import storesData from "@/data/stores.json";
import { haversineDistance } from "@/src/utils/location/distance";

/* =========================================
   Types
========================================= */

type Location = {
  lat: number;
  lng: number;
};

export type Store = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  location?: Location;
  isFavorite?: boolean;
  distance?: number;
};

type StoresContextType = {
  stores: Store[];
  storesSorted: Store[];
  favoriteStores: Store[];

  toggleFavorite: (id: string) => void;
  getStoreById: (id: string) => Store | undefined;

  setUserLocation: (loc: Location) => void;
};

/* =========================================
   Context
========================================= */

const StoresContext = createContext<StoresContextType | null>(null);

const FAVORITES_KEY = "stores_favorites";
const DISTANCE_KEY = "stores_distances";

/* =========================================
   Provider
========================================= */

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [userLocation, setUserLocation] = useState<Location | null>(null);

  /* -------------------------------
     Init stores + favoritos
  -------------------------------- */
  useEffect(() => {
    const init = async () => {
      const favRaw = await AsyncStorage.getItem(FAVORITES_KEY);

      const favorites: Record<string, boolean> = favRaw
        ? JSON.parse(favRaw)
        : {};

      const initialStores: Store[] = storesData.map((s: any) => ({
        ...s,
        isFavorite: favorites[s.id] ?? false,
      }));

      setStores(initialStores);
    };

    init();
  }, []);

  /* -------------------------------
     Toggle favorito ⭐
  -------------------------------- */
  const toggleFavorite = async (id: string) => {
    setStores((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, isFavorite: !s.isFavorite } : s,
      );

      const favMap = Object.fromEntries(
        updated.filter((s) => s.isFavorite).map((s) => [s.id, true]),
      );

      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favMap));

      return updated;
    });
  };

  /* -------------------------------
     Distancias + cache
  -------------------------------- */
  useEffect(() => {
    if (!userLocation) return;

    const compute = async () => {
      const raw = await AsyncStorage.getItem(DISTANCE_KEY);
      const cache: Record<string, number> = raw ? JSON.parse(raw) : {};

      const updated = stores.map((store) => {
        if (!store.location) return store;

        let distance = cache[store.id];

        if (!distance) {
          distance = haversineDistance(
            userLocation.lat,
            userLocation.lng,
            store.location.lat,
            store.location.lng,
          );
        }

        return { ...store, distance };
      });

      const newCache = Object.fromEntries(
        updated
          .filter((s) => s.distance != null)
          .map((s) => [s.id, s.distance]),
      );

      await AsyncStorage.setItem(DISTANCE_KEY, JSON.stringify(newCache));

      setStores(updated);
    };

    compute();
  }, [userLocation]);

  /* -------------------------------
     Derivados
  -------------------------------- */

  // ⭐ favoritas (CLAVE para favorites.tsx)
  const favoriteStores = useMemo(() => {
    return stores.filter((s) => s.isFavorite);
  }, [stores]);

  // 📍 orden por distancia
  const storesSorted = useMemo(() => {
    return [...stores].sort((a, b) => {
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }, [stores]);

  /* -------------------------------
     Helpers
  -------------------------------- */
  const getStoreById = (id: string) => {
    return stores.find((s) => s.id === id);
  };

  /* -------------------------------
     Context value
  -------------------------------- */
  const value: StoresContextType = {
    stores,
    storesSorted,
    favoriteStores,
    toggleFavorite,
    getStoreById,
    setUserLocation,
  };

  return (
    <StoresContext.Provider value={value}>{children}</StoresContext.Provider>
  );
}

/* =========================================
   Hook
========================================= */

export function useStores() {
  const ctx = useContext(StoresContext);

  if (!ctx) {
    throw new Error("useStores must be used inside StoresProvider");
  }

  return ctx;
}
