/**
 * LocationContext
 *
 * Contexto encargado de gestionar la localización del usuario.
 * Proporciona coordenadas actuales y utilidades relacionadas con la ubicación,
 * utilizadas principalmente para calcular distancias y buscar tiendas cercanas.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import * as Location from "expo-location";
import { Alert, Platform } from "react-native";

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadLocation = async () => {
      try {
        // Permisos
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          setError("Permiso de ubicación denegado");
          setLoading(false);
          return;
        }

        // Posición actual
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!mounted) return;

        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch (e) {
        if (!mounted) return;
        setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadLocation();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        loading,
        error,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation debe usarse dentro de LocationProvider");
  }
  return ctx;
}
