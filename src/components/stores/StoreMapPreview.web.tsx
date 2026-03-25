import { useEffect, useState } from "react";

export default function StoreMapPreview({ lat, lng }) {
  const [Map, setMap] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadMap() {
      const L = await import("leaflet");
      const { MapContainer, TileLayer, Marker } = await import("react-leaflet");

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (mounted) {
        setMap(() => ({ MapContainer, TileLayer, Marker }));
      }
    }

    loadMap();

    return () => {
      mounted = false;
    };
  }, []);

  if (lat == null || lng == null) return null;
  if (!Map) return null;

  const { MapContainer, TileLayer, Marker } = Map;

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[lat, lng]} />
    </MapContainer>
  );
}
