import { Linking, Platform } from "react-native";

export function openGoogleMaps({ lat, lng, label }) {
  const encodedLabel = encodeURIComponent(label || "");

  const url =
    Platform.OS === "ios"
      ? `https://maps.apple.com/?ll=${lat},${lng}&q=${encodedLabel}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  Linking.openURL(url);
}

export function openGoogleMapsSearch(query) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query,
  )}`;
  Linking.openURL(url);
}
