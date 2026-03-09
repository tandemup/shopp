import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 👉 Importa aquí tu seed real generado (stores.json)
import STORES_SEED from "../data/stores.json";

const StoresContext = createContext();

const STORAGE_KEY = "STORES_DATA";

// 🔁 Migración / validación básica de stores
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

  // 🔹 Cargar stores (AsyncStorage → seed)
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const normalized = normalizeStores(parsed);
          if (normalized.length > 0) {
            setStores(normalized);
            setReady(true);
            return;
          }
        }
        // fallback: seed
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

  // 🔹 Persistir cambios (solo cuando está listo)
  useEffect(() => {
    if (!ready || stores.length === 0) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
  }, [stores, ready]);

  // ⭐ Toggle favorito
  const toggleFavorite = (storeId) => {
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, favorite: !s.favorite } : s)),
    );
  };

  // ⭐ Alias semántico
  const toggleFavoriteStore = (storeId) => toggleFavorite(storeId);

  // ⭐ Obtener store por ID
  const getStoreById = (storeId) => {
    return stores.find((s) => s.id === storeId) || null;
  };

  // ⭐ IDs de favoritas
  const favoriteStoreIds = stores.filter((s) => s.favorite).map((s) => s.id);

  // ⭐ Comprobar favorito
  const isFavoriteStore = (storeId) => favoriteStoreIds.includes(storeId);

  // ⭐ Listado de favoritas
  const favoriteStores = stores.filter((s) => s.favorite);

  return (
    <StoresContext.Provider
      value={{
        stores,
        ready, // 👈 útil para evitar renders prematuros
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
