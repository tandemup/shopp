import ListCard from "@/src/components/lists/ListCard";
import { useLists } from "@/src/context/ListsContext";
import { FlatList, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const { lists } = useLists();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis listas</Text>

      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListCard list={item} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No hay listas todavía</Text>
            <Text style={styles.emptyText}>
              Crea una lista para empezar a usar Shopp.
            </Text>
          </View>
        }
        contentContainerStyle={
          lists.length === 0 ? styles.emptyContent : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f6f7fb",
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
  },

  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },

  emptyText: {
    color: "#6b7280",
    lineHeight: 20,
  },
});
