import { Platform } from "react-native";

//const CHAT_SERVER_URL = process.env.EXPO_PUBLIC_CHAT_SERVER_URL || "https://shopp-e071fa278cae.herokuapp.com";

const configuredSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

// Web local en el Mac: http://localhost:3001
// Expo Go en teléfono físico: define EXPO_PUBLIC_SOCKET_URL con la IP LAN del Mac,
// por ejemplo http://192.168.1.50:3001. En un móvil, localhost apunta al propio móvil.
const developmentFallback =
  Platform.OS === "web" ? "http://localhost:3001" : "";

export const SOCKET_SERVER_URL = (
  configuredSocketUrl || developmentFallback
).replace(/\/+$/, "");

if (!SOCKET_SERVER_URL) {
  console.warn(
    "Falta EXPO_PUBLIC_SOCKET_URL. En Expo Go usa la IP LAN del servidor, por ejemplo http://192.168.1.50:3001.",
  );
}
