import type { StoreInput } from "@/src/types/store";

export const STORES_SEED: StoreInput[] = [
  {
    name: "Mercadona",
    city: "Madrid",
    provincia: "Madrid",
    address: "Calle de ejemplo 1",
    zipcode: "28001",
    location: { lat: 40.4168, lng: -3.7038, source: "seed" },
    favorite: true,
    isActive: true,
  },
  {
    name: "Carrefour",
    city: "Madrid",
    provincia: "Madrid",
    address: "Avenida de ejemplo 25",
    zipcode: "28002",
    location: { lat: 40.418, lng: -3.701, source: "seed" },
    favorite: false,
    isActive: true,
  },
  {
    name: "Lidl",
    city: "Madrid",
    provincia: "Madrid",
    address: "Plaza de ejemplo 8",
    zipcode: "28003",
    location: { lat: 40.412, lng: -3.708, source: "seed" },
    favorite: false,
    isActive: true,
  },
  {
    name: "Alcampo",
    city: "Madrid",
    provincia: "Madrid",
    address: "Ronda de ejemplo 12",
    zipcode: "28004",
    location: { lat: 40.421, lng: -3.695, source: "seed" },
    favorite: false,
    isActive: true,
  },
];
