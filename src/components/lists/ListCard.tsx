import { List } from "@/src/types/List";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  list: List;
}

export default function ListCard({ list }: Props) {
  const router = useRouter();

  function openList() {
    router.push(`/list/${list.id}`);
  }

  const itemCount = list.items.length;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
      onPress={openList}
    >
      <View style={styles.cardTop}>
        <Text style={styles.listName}>{list.name}</Text>

        <View style={styles.currency}>
          <Text style={styles.currencyText}>{list.currency}</Text>
        </View>

        <Pressable style={styles.menu}>
          <Ionicons name="ellipsis-vertical" size={18} color="#555" />
        </Pressable>
      </View>

      <Text style={styles.meta}>
        Creada el {new Date(list.createdAt).toLocaleDateString()}
      </Text>

      <Text style={styles.meta}>
        {itemCount} {itemCount === 1 ? "producto" : "productos"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#cfd7ff",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  listName: {
    fontSize: 16,
    fontWeight: "600",
  },

  currency: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#eef0ff",
  },

  currencyText: {
    fontSize: 12,
    color: "#4b5bdc",
    fontWeight: "600",
  },

  menu: {
    marginLeft: "auto",
  },

  meta: {
    fontSize: 12,
    color: "#666",
  },
});
