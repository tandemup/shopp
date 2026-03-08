/**
 * ConfigContext
 *
 * Contexto global de configuración de la aplicación.
 * Centraliza flags, preferencias del usuario y ajustes generales
 * que afectan al comportamiento global de la app.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ConfigContext = createContext();
const FAVORITES_KEY = "favoriteStores";

export function ConfigProvider({ children }) {
  const [favoriteStores, setFavoriteStores] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then((raw) => {
      if (raw) setFavoriteStores(JSON.parse(raw));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteStores));
  }, [favoriteStores]);

  const toggleFavoriteStore = (storeId) => {
    setFavoriteStores((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId]
    );
  };

  const isFavoriteStore = (storeId) => favoriteStores.includes(storeId);

  return (
    <ConfigContext.Provider
      value={{
        favoriteStores,
        toggleFavoriteStore,
        isFavoriteStore,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext);
