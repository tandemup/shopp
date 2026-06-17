const rawSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

if (!rawSocketUrl) {
  throw new Error(
    [
      "Falta la variable EXPO_PUBLIC_SOCKET_URL.",
      "Configúrala en:",
      "- .env.local para desarrollo local",
      "- Netlify para la versión web",
      "- EAS para compilaciones Android/iOS",
    ].join("\n"),
  );
}

if (
  !rawSocketUrl.startsWith("https://") &&
  !rawSocketUrl.startsWith("http://")
) {
  throw new Error(
    "EXPO_PUBLIC_SOCKET_URL debe comenzar por https:// o http://",
  );
}

export const SOCKET_SERVER_URL = rawSocketUrl.replace(/\/+$/, "");
