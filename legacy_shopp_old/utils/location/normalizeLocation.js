// utils/location/normalizeLocation.js

export function normalizeLocation(loc) {
  if (!loc) return null;

  // Nuevo formato
  if (typeof loc.lat === "number" && typeof loc.lng === "number") {
    return {
      lat: loc.lat,
      lng: loc.lng,
      source: loc.source ?? "unknown",
    };
  }

  // Legacy
  if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
    return {
      lat: loc.latitude,
      lng: loc.longitude,
      source: "legacy",
    };
  }

  return null;
}
