import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Store = {
  id: string;
  name: string;
  city?: string;
  address?: string;
  distanceKm?: number;
  isOpen?: boolean;
  isFavorite?: boolean;
};

type Props = {
  store?: Store;
  onPress?: () => void;
};

export default function StoreSelector({ store, onPress }: Props) {
  const isSelected = !!store;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* ICONO */}
      <View style={styles.iconWrapper}>
        <Ionicons
          name="storefront"
          size={22}
          color={isSelected ? "#2F80ED" : "#999"}
        />
      </View>

      {/* TEXTO */}
      <View style={styles.textContainer}>
        <Text style={styles.label}>
          {isSelected ? "Tienda seleccionada" : "Seleccionar tienda"}
        </Text>

        {isSelected ? (
          <>
            {/* NOMBRE + FAVORITO */}
            <View style={styles.row}>
              <Text style={styles.name}>{store.name}</Text>

              {store.isFavorite && (
                <Ionicons
                  name="star"
                  size={14}
                  color="#F2C94C"
                  style={{ marginLeft: 6 }}
                />
              )}
            </View>

            {/* ADDRESS */}
            <Text style={styles.address}>
              {store.address ?? store.city ?? ""}
            </Text>

            {/* META INFO */}
            <View style={styles.metaRow}>
              {/* DISTANCIA */}
              {store.distanceKm !== undefined && (
                <Text style={styles.metaText}>
                  📍 {store.distanceKm.toFixed(1)} km
                </Text>
              )}

              {/* ESTADO */}
              {store.isOpen !== undefined && (
                <Text
                  style={[
                    styles.metaText,
                    store.isOpen ? styles.open : styles.closed,
                  ]}
                >
                  {store.isOpen ? "Abierto" : "Cerrado"}
                </Text>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.placeholder}>Ninguna tienda seleccionada</Text>
        )}
      </View>

      {/* CHEVRON */}
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    marginVertical: 8,

    // sombra iOS + Android
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  iconWrapper: {
    width: 36,
    alignItems: "center",
  },

  textContainer: {
    flex: 1,
    marginLeft: 8,
  },

  label: {
    fontSize: 13,
    color: "#888",
    marginBottom: 2,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  name: {
    fontSize: 17,
    fontWeight: "600",
    color: "#222",
  },

  address: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },

  metaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  metaText: {
    fontSize: 12,
    color: "#666",
  },

  open: {
    color: "#27ae60",
    fontWeight: "500",
  },

  closed: {
    color: "#eb5757",
    fontWeight: "500",
  },

  placeholder: {
    fontSize: 15,
    color: "#aaa",
  },
});
