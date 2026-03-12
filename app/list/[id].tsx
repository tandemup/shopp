import { useLocalSearchParams } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

import ItemRow from "@/src/components/items/ItemRow";
import SearchCombinedBar from "@/src/components/shopping/SearchCombinedBar";
import StoreSelector from "@/src/components/shopping/StoreSelector";
import TotalBar from "@/src/components/shopping/TotalBar";

export default function ShoppingListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const items = [
    { id: "1", name: "zumo", quantity: 2, price: 3.5, checked: true },
    { id: "2", name: "manzanas", quantity: 2, price: 3.5, checked: true },
  ];

  const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Lista1</Text>

      <StoreSelector />

      <SearchCombinedBar />

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ItemRow item={item} />}
      />

      <TotalBar total={total} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f2f2f2",
  },

  header: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10,
  },
});
