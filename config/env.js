import { Platform } from "react-native";

const configuredSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

// Web local en el Mac:
//   http://localhost:3000
//
// Expo Go en teléfono físico:
//   usa la IP LAN del Mac, por ejemplo:
//   http://192.168.1.50:3000
//
// Producción / Netlify / Heroku:
//   define EXPO_PUBLIC_SOCKET_URL con la URL pública del servidor,
//   por ejemplo:
//   https://shopp-e071fa278cae.herokuapp.com
//
// Importante:
//   En un móvil, localhost apunta al propio móvil, no al Mac.
const developmentFallback =
  Platform.OS === "web" ? "http://localhost:3000" : "";

export const SOCKET_SERVER_URL = (
  configuredSocketUrl || developmentFallback
).replace(/\/+$/, "");

if (!SOCKET_SERVER_URL) {
  console.warn(
    "Falta EXPO_PUBLIC_SOCKET_URL. En Expo Go usa la IP LAN del servidor, por ejemplo http://192.168.1.50:3000.",
  );
}
