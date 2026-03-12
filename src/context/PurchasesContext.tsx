import React, { createContext, useContext, useState } from "react";
import { Purchase } from "../types/Purchase";

type PurchasesContextType = {
  purchases: Purchase[];
  addPurchase: (purchase: Purchase) => void;
};

const PurchasesContext = createContext<PurchasesContextType | null>(null);

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const addPurchase = (purchase: Purchase) => {
    setPurchases((prev) => [...prev, purchase]);
  };

  return (
    <PurchasesContext.Provider value={{ purchases, addPurchase }}>
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx)
    throw new Error("usePurchases must be used inside PurchasesProvider");
  return ctx;
}
