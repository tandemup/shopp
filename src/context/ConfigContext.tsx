import React, { createContext, useContext, useState } from "react"

type Config = {
  currency: string
}

type ConfigContextType = {
  config: Config
  setCurrency: (currency: string) => void
}

const ConfigContext = createContext<ConfigContextType | null>(null)

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config>({ currency: "EUR" })

  const setCurrency = (currency: string) => {
    setConfig(prev => ({ ...prev, currency }))
  }

  return (
    <ConfigContext.Provider value={{ config, setCurrency }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error("useConfig must be used inside ConfigProvider")
  return ctx
}