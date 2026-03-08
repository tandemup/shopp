import React, { useCallback } from "react";
import { Text, View, Pressable, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { SEARCH_ENGINES, DEFAULT_ENGINE } from "../constants/searchEngines";

export default function BarcodeLink({
  barcode,
  styleType = "default",
  iconColor = "#6b7280",
}) {
  if (!barcode) return null;

  const styles = {
    default: { fontSize: 14, color: "#1d4ed8" },
    subtle: { fontSize: 12, color: "#6b7280" },
  };

  const handlePress = useCallback(
    async (e) => {
      e.stopPropagation();

      try {
        const selectedKey =
          (await AsyncStorage.getItem("searchEngine")) || DEFAULT_ENGINE;

        const engine =
          SEARCH_ENGINES[selectedKey] || SEARCH_ENGINES[DEFAULT_ENGINE];

        const url = engine.buildUrl(barcode);

        Linking.openURL(url);
      } catch (err) {
        console.warn("Error opening barcode link", err);
      }
    },
    [barcode],
  );

  return (
    <Pressable
      onPress={handlePress}
      style={Platform.OS === "web" ? { display: "inline-flex" } : undefined}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons
          name="barcode-outline"
          size={14}
          color={iconColor}
          style={{ marginRight: 4 }}
        />
        <Text style={[styles[styleType], { textDecorationLine: "underline" }]}>
          {barcode}
        </Text>
      </View>
    </Pressable>
  );
}
