import { useEffect, useState } from "react";
import stores from "../data/stores.json";
import {
  getCurrentLocation,
  haversineDistance,
} from "../utils/helpers/locationHelpers";
import {
  loadStoresDistance,
  saveStoresDistance,
} from "../utils/helpers/storesDistanceCache";

export function useStoresWithDistance() {
  const [sortedStores, setSortedStores] = useState(stores);
  const [userLocation, setUserLocation] = useState(null);
  const [hasLocation, setHasLocation] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    // 1️⃣ Intentar cache
    const cached = await loadStoresDistance();
    if (cached) {
      setSortedStores(cached.stores);
      setUserLocation(cached.userLocation);
      setHasLocation(true);
      setLoading(false);
      return;
    }

    // 2️⃣ Obtener ubicación (usa cache GPS si existe)
    const location = await getCurrentLocation();
    if (!location) {
      setLoading(false);
      return;
    }

    // 3️⃣ Calcular distancias
    const updated = stores
      .map((store) => ({
        ...store,
        distance: haversineDistance(location, store.location),
      }))
      .sort((a, b) => a.distance - b.distance);

    // 4️⃣ Guardar cache
    await saveStoresDistance({
      userLocation: location,
      stores: updated,
    });

    setSortedStores(updated);
    setUserLocation(location);
    setHasLocation(true);
    setLoading(false);
  };

  return {
    sortedStores,
    userLocation,
    hasLocation,
    loading,
  };
}
