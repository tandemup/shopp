import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Item = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  checked?: boolean;
  offer?: string;
};

type Props = {
  item: Item;
  onToggle?: (id: string) => void;
};

export default function ItemRow({ item, onToggle }: Props) {
  const router = useRouter();

  function toggle() {
    onToggle?.(item.id);
  }

  function openDetail() {
    router.push(`/item/${item.id}`);
  }

  const total = item.quantity * item.price;

  return (
    <View style={styles.row}>
      {/* checkbox */}

      <Pressable onPress={toggle} style={styles.checkbox}>
        <Ionicons
          name={item.checked ? "checkbox" : "square-outline"}
          size={22}
          color="#28c76f"
        />
      </Pressable>

      {/* product info */}

      <View style={styles.center}>
        <Text style={styles.name}>{item.name}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {item.quantity} × {item.price.toFixed(2)} €
          </Text>

          {item.offer && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.offer}</Text>
            </View>
          )}
        </View>
      </View>

      {/* total */}

      <Text style={styles.total}>{total.toFixed(2)} €</Text>

      {/* chevron */}

      <Pressable onPress={openDetail} style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },

  checkbox: {
    marginRight: 10,
  },

  center: {
    flex: 1,
  },

  name: {
    fontSize: 16,
    fontWeight: "500",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  meta: {
    fontSize: 12,
    color: "#777",
  },

  badge: {
    backgroundColor: "#ffd400",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  total: {
    fontWeight: "600",
    color: "#28c76f",
    marginRight: 6,
  },

  chevron: {
    paddingLeft: 4,
  },
});
