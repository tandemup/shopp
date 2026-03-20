import { Currency } from "@/src/types/Currency";
import { createContext, useContext, useState } from "react";

type Config = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
};

const ConfigContext = createContext<Config | null>(null);

export function ConfigProvider({ children }: any) {
  const [currency, setCurrency] = useState<Currency>("EUR");

  return (
    <ConfigContext.Provider value={{ currency, setCurrency }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig outside provider");
  return ctx;
}
