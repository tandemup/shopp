import React, { createContext, useContext, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const StoresContext = createContext();

const normalizeStores = (stores) => {
  if (!Array.isArray(stores)) return [];

  return stores.filter(
    (s) =>
      typeof s?.id === "string" &&
      s.id.length >= 8 &&
      typeof s.name === "string" &&
      typeof s.address === "string" &&
      s.location &&
      typeof s.location.lat === "number" &&
      typeof s.location.lng === "number",
  );
};

export const StoresProvider = ({ children }) => {
  const currentUser = useQuery(api.users.current);
  const isAdmin =
    currentUser?.isAdmin === true || currentUser?.role === "admin";
  // El catálogo de tiendas es una herramienta DEV. Los compradores pueden
  // seguir usando sus listas locales sin descargar toda la tabla en cada
  // inicio de sesión.
  const convexStores = useQuery(
    api.stores.listStoresWithMyFavorites,
    isAdmin ? {} : "skip",
  );
  const toggleFavoriteMutation = useMutation(api.stores.toggleMyFavoriteStore);

  const stores = useMemo(() => normalizeStores(convexStores), [convexStores]);

  const ready = !isAdmin || convexStores !== undefined;

  const favoriteStores = useMemo(() => {
    return stores.filter((store) => store.favorite === true);
  }, [stores]);

  const favoriteStoreIds = useMemo(() => {
    return favoriteStores.map((store) => store.id);
  }, [favoriteStores]);

  const toggleFavorite = async (storeId) => {
    if (!storeId) return null;

    return await toggleFavoriteMutation({ id: storeId });
  };

  const toggleFavoriteStore = toggleFavorite;

  const getStoreById = (storeId) =>
    stores.find((store) => store.id === storeId) || null;

  const isFavoriteStore = (storeId) => favoriteStoreIds.includes(storeId);

  const reloadStoresFromSeed = async () => {
    console.warn(
      "reloadStoresFromSeed ya no se usa: las tiendas se cargan desde Convex.",
    );
  };

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
        reloadStoresFromSeed,
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
