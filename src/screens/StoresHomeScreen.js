import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { ROUTES } from "../navigation/ROUTES";

/* -------------------------------------------------
   Menu Item
-------------------------------------------------- */
function MenuItem({ icon, title, subtitle, onPress }) {
  return (
    <Pressable
      style={styles.menuItem}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={26} color="#2e7d32" />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <Ionicons name="chevron-forward" size={22} color="#999" />
    </Pressable>
  );
}

/* -------------------------------------------------
   Screen
-------------------------------------------------- */
export default function StoresHomeScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Gestión de tiendas</Text>

      <MenuItem
        icon="storefront-outline"
        title="Explorar tiendas"
        subtitle="Buscar tiendas cercanas o por nombre"
        onPress={() => navigation.navigate(ROUTES.STORES_BROWSE)}
      />

      <MenuItem
        icon="star-outline"
        title="Tiendas favoritas"
        subtitle="Acceso rápido a tus tiendas habituales"
        onPress={() => navigation.navigate(ROUTES.STORES_FAVORITES)}
      />

      <MenuItem
        icon="map-outline"
        title="Tiendas cercanas"
        subtitle="Ordenadas por distancia"
        onPress={() => navigation.navigate(ROUTES.STORES_NEARBY)}
      />

      <MenuItem
        icon="information-circle-outline"
        title="Información de tiendas"
        subtitle="Horarios, direcciones y estado"
        onPress={() => navigation.navigate(ROUTES.STORE_INFO)}
      />
    </ScrollView>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6",
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    color: "#222",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
});
