/**
 * PurchasesContext
 *
 * Contexto encargado del historial de compras realizadas.
 * Gestiona la persistencia y consulta de compras finalizadas,
 * separando este flujo del manejo de listas activas.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* -------------------------------------------------
   Context
-------------------------------------------------- */
const PurchasesContext = createContext(null);

const STORAGE_KEY = "@purchaseHistory";

/* -------------------------------------------------
   Provider
-------------------------------------------------- */
export function PurchasesProvider({ children }) {
  const [purchases, setPurchases] = useState([]);
  const [isReady, setIsReady] = useState(false);

  /* -------------------------------------------------
     Load from storage
  -------------------------------------------------- */
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setPurchases(JSON.parse(raw));
        }
      } catch (err) {
        console.warn("Error loading purchases", err);
      } finally {
        setIsReady(true);
      }
    };

    load();
  }, []);

  /* -------------------------------------------------
     Persist
  -------------------------------------------------- */
  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(purchases));
  }, [purchases, isReady]);

  /* -------------------------------------------------
     Helpers
  -------------------------------------------------- */
  const generateId = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2);

  /* -------------------------------------------------
     API
  -------------------------------------------------- */

  // ➕ Añadir compra
  const addPurchase = ({ store, items }) => {
    const total = (items ?? []).reduce(
      (sum, i) => sum + (i.priceInfo?.total ?? 0),
      0
    );

    const purchase = {
      id: generateId(),
      store,
      date: new Date().toISOString(),
      items,
      total,
    };

    setPurchases((prev) => [purchase, ...prev]);

    return purchase;
  };

  // 🗑 Eliminar compra
  const deletePurchase = (purchaseId) => {
    setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
  };

  // 🧹 Limpiar historial
  const clearPurchases = () => {
    setPurchases([]);
  };

  /* -------------------------------------------------
     Value
  -------------------------------------------------- */
  const value = useMemo(
    () => ({
      purchases,
      isReady,

      addPurchase,
      deletePurchase,
      clearPurchases,
    }),
    [purchases, isReady]
  );

  return (
    <PurchasesContext.Provider value={value}>
      {children}
    </PurchasesContext.Provider>
  );
}

/* -------------------------------------------------
   Hook
-------------------------------------------------- */
export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx) {
    throw new Error("usePurchases must be used inside PurchasesProvider");
  }
  return ctx;
}
