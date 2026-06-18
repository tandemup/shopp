import { Platform } from "react-native";

const configuredSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

const developmentFallback =
  Platform.OS === "web" ? "http://localhost:3001" : "http://192.168.1.50:3001";

export const SOCKET_SERVER_URL = (
  configuredSocketUrl || (__DEV__ ? developmentFallback : "")
).replace(/\/+$/, "");

if (!SOCKET_SERVER_URL) {
  console.warn(
    "Falta EXPO_PUBLIC_SOCKET_URL. El chat permanecerá desconectado hasta configurarla.",
  );
}
