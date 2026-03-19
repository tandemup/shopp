import * as Location from "expo-location";
import { createContext, useContext, useEffect, useState } from "react";

type LocationType = {
  lat: number;
  lng: number;
} | null;

const LocationContext = createContext<{
  location: LocationType;
}>({
  location: null,
});

export function LocationProvider({ children }: any) {
  const [location, setLocation] = useState<LocationType>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    })();
  }, []);

  return (
    <LocationContext.Provider value={{ location }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocation = () => useContext(LocationContext);
