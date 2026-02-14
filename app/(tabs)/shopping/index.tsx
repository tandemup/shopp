import { useShoppingStore } from "@/state/shoppingStore";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ShoppingScreen() {
  const [newList, setNewList] = useState("");

  const lists = useShoppingStore((s) => s.lists);
  const addList = useShoppingStore((s) => s.addList);

  const handleAdd = () => {
    if (!newList.trim()) return;
    addList(newList.trim());
    setNewList("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Listas</Text>

      <View style={styles.inputRow}>
        <TextInput
          placeholder="Nueva lista..."
          value={newList}
          onChangeText={setNewList}
          style={styles.input}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Ionicons name="add" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(tabs)/shopping/${item.id}`)}
          >
            <Text style={styles.cardText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: "#2e7d32",
    padding: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  cardText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
