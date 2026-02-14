import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useShoppingStore } from "@/state/shoppingStore";

export default function ShoppingScreen() {
  const [newList, setNewList] = useState("");

  const lists = useShoppingStore((s) => s.lists);
  const addList = useShoppingStore((s) => s.addList);
  const removeList = useShoppingStore((s) => s.removeList);

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

      {lists.length === 0 ? (
        <Text style={styles.empty}>No tienes listas activas 😊</Text>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardText}>{item.name}</Text>
              <TouchableOpacity onPress={() => removeList(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#c62828" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
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
  empty: {
    textAlign: "center",
    marginTop: 40,
    color: "#999",
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  cardText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
