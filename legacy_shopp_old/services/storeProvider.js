// services/storeProvider.js
export async function fetchStoresFromOSM({ lat, lon, radius = 1500 }) {
  const query = `
[out:json];
(
  node["shop"="supermarket"](around:${radius},${lat},${lon});
  node["shop"="convenience"](around:${radius},${lat},${lon});
  node["shop"="grocery"](around:${radius},${lat},${lon});
);
out body;
`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  const json = await response.json();
  return json.elements ?? [];
}
