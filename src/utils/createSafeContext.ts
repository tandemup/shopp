import { createContext, useContext } from "react";

export function createSafeContext<T>(name: string) {
  const ctx = createContext<T | undefined>(undefined);

  function useSafeContext() {
    const value = useContext(ctx);
    if (!value) {
      throw new Error(`${name} must be used inside its Provider`);
    }
    return value;
  }

  return [ctx.Provider, useSafeContext] as const;
}
