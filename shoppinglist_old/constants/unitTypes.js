// constants/unitTypes.js

export const UNIT_TYPES = [
  { key: "u", emoji: "🧩", label: "Unidad" },
  { key: "kg", emoji: "⚖️", label: "Kilo" },
  { key: "l", emoji: "🧃", label: "Litro" },
];

// Un diccionario rápido para acceder por clave
export const UNIT_BY_KEY = UNIT_TYPES.reduce((acc, u) => {
  acc[u.key] = u;
  return acc;
}, {});
