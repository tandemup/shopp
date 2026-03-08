export async function getStoresNearby(req, res) {
  const { lat, lon, radius = 1500 } = req.query;

  if (!lat || !lon)
    return res.status(400).json({ error: "lat & lon required" });

  const delta = radius / 111000; // metros → grados aprox

  const bbox = [
    Number(lat) - delta,
    Number(lat) + delta,
    Number(lon) - delta,
    Number(lon) + delta,
  ];

  const elements = await fetchSupermarkets(bbox);
  const stores = elements.map(normalizeOSMStore);

  res.json(stores);
}
