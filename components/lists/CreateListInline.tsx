import { api } from "@/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

export function CreateListInline() {
  const [name, setName] = useState("");
  const createList = useMutation(api.lists.create);

  const handleCreate = async () => {
    if (!name.trim()) return;

    await createList({
      name: name.trim(),
      currency: "EUR",
    });

    setName("");
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Nueva lista..."
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <Pressable style={styles.button} onPress={handleCreate}>
        <Ionicons name="add" size={20} color="white" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: "#fff",
  },

  button: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
});
