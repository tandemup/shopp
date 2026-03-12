import ListCard from "@/src/components/lists/ListCard";
import { FlatList, StyleSheet, Text, View } from "react-native";

const lists = [
  {
    id: "1",
    name: "Lista1",
    currency: "EUR",
    createdAt: Date.now(),
  },
];

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Listas</Text>

      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListCard list={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
  },
});
