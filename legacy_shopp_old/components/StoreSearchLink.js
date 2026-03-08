import React from "react";
import { Text, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function StoreSearchLink({
  store,
  onPressStore,
  iconColor = "#2563eb",
  textStyle,
}) {
  if (!store) {
    return <Text style={[{ color: "#999" }, textStyle]}>Sin tienda</Text>;
  }

  const handlePress = () => {
    if (onPressStore) {
      onPressStore(store.id);
      return;
    }

    const query = encodeURIComponent(store.name);
    Linking.openURL(`https://www.google.com/search?q=${query}`);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.6}
      hitSlop={8}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <Ionicons name="location-outline" size={16} color={iconColor} />
      <Text
        style={[
          { color: iconColor, fontSize: 14, fontWeight: "500" },
          textStyle,
        ]}
      >
        {store.name}
      </Text>
    </TouchableOpacity>
  );
}
