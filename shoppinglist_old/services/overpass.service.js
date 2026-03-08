const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function fetchSupermarkets(bbox) {
  const [south, north, west, east] = bbox;

  const query = `
    [out:json][timeout:25];
    (
      node["shop"="supermarket"](${south},${west},${north},${east});
      way["shop"="supermarket"](${south},${west},${north},${east});
    );
    out center tags;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: query,
  });

  const data = await res.json();
  return data.elements ?? [];
}
