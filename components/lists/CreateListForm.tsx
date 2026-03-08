import { useMutation } from "convex/react";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";

export function CreateListForm() {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createList = useMutation(api.lists.create);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await createList({
        name: trimmed,
        currency: "EUR",
      });
      setName("");
    } catch (error) {
      console.error("Failed to create list:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="New shopping list"
        value={name}
        onChangeText={setName}
        style={styles.input}
        editable={!isSubmitting}
      />

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleCreate}
      >
        <Text style={styles.buttonText}>
          {isSubmitting ? "Creating..." : "Create list"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
