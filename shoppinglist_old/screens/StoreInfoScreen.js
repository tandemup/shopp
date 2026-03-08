import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { ROUTES } from "../navigation/ROUTES";

export default function StoreInfoScreen() {
  const navigation = useNavigation();

  const handleExploreStores = () => {
    navigation.navigate(ROUTES.STORES_TAB, {
      screen: ROUTES.STORES,
      // params opcionales, no rompe aunque no existan
      params: {
        mode: "browse",
      },
    });
  };

  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>Información de tiendas</Text>

      <Text style={styles.emptySubtitle}>
        Aquí podrás consultar información general sobre las tiendas, horarios
        especiales y condiciones.
      </Text>

      <Pressable style={styles.exploreButton} onPress={handleExploreStores}>
        <Text style={styles.exploreText}>Explorar tiendas</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },

  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },

  exploreButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },

  exploreText: {
    color: "#fff",
    fontWeight: "600",
  },
});
