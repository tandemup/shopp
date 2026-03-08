const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function geocode(query) {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(
    query
  )}&format=json&addressdetails=1&limit=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Expo-Shop/1.0 (contact@expo-shop.dev)",
    },
  });

  const data = await res.json();
  return data[0] ?? null;
}
