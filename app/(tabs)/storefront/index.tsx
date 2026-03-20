import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

/* -------------------------------------------------
   Menu Item
-------------------------------------------------- */
function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color="#2e7d32" />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <Ionicons name="chevron-forward" size={20} color="#999" />
    </Pressable>
  );
}

/* -------------------------------------------------
   Screen
-------------------------------------------------- */
export default function StorefrontHomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Gestión de tiendas</Text>

      <MenuItem
        icon="storefront-outline"
        title="Explorar tiendas"
        subtitle="Buscar tiendas cercanas o por nombre"
        onPress={() => router.push("/storefront/explore")}
      />

      <MenuItem
        icon="star-outline"
        title="Tiendas favoritas"
        subtitle="Acceso rápido a tus tiendas habituales"
        onPress={() => router.push("/storefront/favorites")}
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
    borderRadius: 14,
    marginBottom: 12,

    // sombra iOS
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },

    // sombra Android
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
