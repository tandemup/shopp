import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ProductLearningContext = createContext(null);
const STORAGE_KEY = "@productLearning";

/* -------------------------------------------------
   Provider
-------------------------------------------------- */
export function ProductLearningProvider({ children }) {
  const [learning, setLearning] = useState({});

  /* ---------------------------
     Load
  ----------------------------*/
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setLearning(JSON.parse(raw));
    });
  }, []);

  /* ---------------------------
     Persist
  ----------------------------*/
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(learning));
  }, [learning]);

  /* ---------------------------
     API
  ----------------------------*/
  const recordSelection = (name) => {
    if (!name) return;

    setLearning((prev) => {
      const key = name.toLowerCase();
      const curr = prev[key] ?? { selects: 0, lastSelect: null };

      return {
        ...prev,
        [key]: {
          selects: curr.selects + 1,
          lastSelect: new Date().toISOString(),
        },
      };
    });
  };

  const value = useMemo(
    () => ({
      learning,
      recordSelection,
    }),
    [learning]
  );

  return (
    <ProductLearningContext.Provider value={value}>
      {children}
    </ProductLearningContext.Provider>
  );
}

/* -------------------------------------------------
   Hook
-------------------------------------------------- */
export function useProductLearning() {
  const ctx = useContext(ProductLearningContext);
  if (!ctx) {
    throw new Error(
      "useProductLearning must be used inside ProductLearningProvider"
    );
  }
  return ctx;
}
