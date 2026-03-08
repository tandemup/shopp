import { useMutation } from "convex/react";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";

type AddItemFormProps = {
  listId: any;
};

export function AddItemForm({ listId }: AddItemFormProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addItem = useMutation(api.listItems.add);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !listId || isSubmitting) return;

    const parsedQuantity = Number(quantity);
    const parsedUnitPrice = Number(unitPrice);

    try {
      setIsSubmitting(true);

      await addItem({
        listId,
        name: trimmedName,
        quantity:
          Number.isFinite(parsedQuantity) && parsedQuantity > 0
            ? parsedQuantity
            : 1,
        unitPrice: Number.isFinite(parsedUnitPrice) ? parsedUnitPrice : 0,
        checked: false,
      });

      setName("");
      setQuantity("1");
      setUnitPrice("");
    } catch (error) {
      console.error("Failed to add item:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Item name"
        value={name}
        onChangeText={setName}
        style={styles.input}
        editable={!isSubmitting}
      />

      <View style={styles.row}>
        <TextInput
          placeholder="Qty"
          value={quantity}
          onChangeText={setQuantity}
          style={[styles.input, styles.smallInput]}
          keyboardType="numeric"
          editable={!isSubmitting}
        />

        <TextInput
          placeholder="Unit price"
          value={unitPrice}
          onChangeText={setUnitPrice}
          style={[styles.input, styles.smallInput]}
          keyboardType="numeric"
          editable={!isSubmitting}
        />
      </View>

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleAdd}
      >
        <Text style={styles.buttonText}>
          {isSubmitting ? "Adding..." : "Add item"}
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
  row: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  smallInput: {
    flex: 1,
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
