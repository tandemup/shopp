import { useShoppingStore } from "@/state/shoppingStore";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ShoppingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [newItem, setNewItem] = useState("");

  const list = useShoppingStore((s) => s.lists.find((l) => l.id === id));

  const addItem = useShoppingStore((s) => s.addItem);
  const toggleItem = useShoppingStore((s) => s.toggleItem);
  const removeItem = useShoppingStore((s) => s.removeItem);

  if (!list) {
    return (
      <View style={styles.container}>
        <Text>Lista no encontrada</Text>
      </View>
    );
  }

  const handleAdd = () => {
    if (!newItem.trim()) return;
    addItem(list.id, newItem.trim());
    setNewItem("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{list.name}</Text>

      <View style={styles.inputRow}>
        <TextInput
          placeholder="Nuevo producto..."
          value={newItem}
          onChangeText={setNewItem}
          style={styles.input}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Ionicons name="add" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => toggleItem(list.id, item.id)}
            >
              <Text
                style={[styles.itemText, item.completed && styles.completed]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => removeItem(list.id, item.id)}>
              <Ionicons name="trash-outline" size={20} color="#c62828" />
            </TouchableOpacity>
          </View>
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
  itemRow: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemText: {
    fontSize: 16,
  },
  completed: {
    textDecorationLine: "line-through",
    color: "#999",
  },
});
