import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "../src/storage/storage";
import { STORAGE_KEYS } from "../src/storage/storageKeys";

// 👉 Seed
import STORES_SEED from "../data/stores.json";

const StoresContext = createContext();

/* -------------------------------------------------
   Normalización
-------------------------------------------------- */
const normalizeStores = (stores) => {
  if (!Array.isArray(stores)) return [];

  return stores.filter(
    (s) =>
      typeof s?.id === "string" &&
      s.id.length >= 8 &&
      typeof s.name === "string" &&
      typeof s.address === "string",
  );
};

export const StoresProvider = ({ children }) => {
  const [stores, setStores] = useState([]);
  const [ready, setReady] = useState(false);

  /* -------------------------------------------------
     Carga inicial
  -------------------------------------------------- */
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await storage.getJSON(STORAGE_KEYS.STORES, null);

        if (stored) {
          const normalized = normalizeStores(stored);

          if (normalized.length > 0) {
            setStores(normalized);
            return;
          }
        }

        // fallback → seed
        setStores(STORES_SEED);
      } catch (e) {
        console.warn("Error loading stores", e);
        setStores(STORES_SEED);
      } finally {
        setReady(true);
      }
    };

    load();
  }, []);

  /* -------------------------------------------------
     Persistencia
  -------------------------------------------------- */
  useEffect(() => {
    if (!ready || stores.length === 0) return;

    storage.setJSON(STORAGE_KEYS.STORES, stores);
  }, [stores, ready]);

  /* -------------------------------------------------
     Favoritos
  -------------------------------------------------- */
  const toggleFavorite = (storeId) => {
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, favorite: !s.favorite } : s)),
    );
  };

  const toggleFavoriteStore = toggleFavorite;

  /* -------------------------------------------------
     Selectores
  -------------------------------------------------- */
  const getStoreById = (storeId) =>
    stores.find((s) => s.id === storeId) || null;

  const favoriteStores = stores.filter((s) => s.favorite);
  const favoriteStoreIds = favoriteStores.map((s) => s.id);

  const isFavoriteStore = (storeId) => favoriteStoreIds.includes(storeId);

  return (
    <StoresContext.Provider
      value={{
        stores,
        ready,
        favoriteStores,
        favoriteStoreIds,
        toggleFavorite,
        toggleFavoriteStore,
        isFavoriteStore,
        getStoreById,
      }}
    >
      {children}
    </StoresContext.Provider>
  );
};

export const useStores = () => {
  const ctx = useContext(StoresContext);
  if (!ctx) {
    throw new Error("useStores must be used within StoresProvider");
  }
  return ctx;
};
