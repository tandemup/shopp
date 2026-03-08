import { AddItemForm } from "@/components/lists/AddItemForm";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StoreSelector } from "../../components/stores/StoreSelector";
import { api } from "../../convex/_generated/api";

export default function ListDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const listId = params.id as any;

  const currentList = useQuery(
    api.lists.getById,
    listId ? { id: listId } : "skip",
  );
  const items = useQuery(api.listItems.byList, listId ? { listId } : "skip");
  const selectedStore = useQuery(
    api.stores.getById,
    currentList?.storeId ? { id: currentList.storeId } : "skip",
  );

  const toggleChecked = useMutation(api.listItems.toggleChecked);
  const removeItem = useMutation(api.listItems.remove);
  const updateItem = useMutation(api.listItems.update);
  const archiveList = useMutation(api.lists.archive);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingQuantity, setEditingQuantity] = useState("");
  const [editingUnitPrice, setEditingUnitPrice] = useState("");

  const estimatedTotal = useMemo(() => {
    if (!items) return 0;
    return items.reduce((acc, item) => {
      const qty = Number(item.quantity ?? 0);
      const price = Number(item.unitPrice ?? 0);
      return acc + qty * price;
    }, 0);
  }, [items]);

  const startEditing = (item: any) => {
    setEditingItemId(item._id);
    setEditingName(item.name ?? "");
    setEditingQuantity(String(item.quantity ?? 1));
    setEditingUnitPrice(
      item.unitPrice !== undefined && item.unitPrice !== null
        ? String(item.unitPrice)
        : "",
    );
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingName("");
    setEditingQuantity("");
    setEditingUnitPrice("");
  };

  const saveEditing = async () => {
    if (!editingItemId) return;

    const trimmedName = editingName.trim();
    if (!trimmedName) return;

    const quantity = Number(editingQuantity);
    const unitPrice = Number(editingUnitPrice);

    await updateItem({
      id: editingItemId,
      name: trimmedName,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
    });

    cancelEditing();
  };

  const handleArchive = async () => {
    if (!listId) return;
    await archiveList({ id: listId });
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{currentList?.name ?? "List detail"}</Text>

          {currentList && (
            <>
              <Text style={styles.subtitle}>
                {currentList.checkedItems ?? 0} / {currentList.totalItems ?? 0}{" "}
                checked
              </Text>
              <Text style={styles.subtitle}>
                Estimated total: {estimatedTotal.toFixed(2)}{" "}
                {currentList.currency}
              </Text>
              <Text style={styles.subtitle}>
                Store:{" "}
                {selectedStore ? selectedStore.name : "No store selected"}
              </Text>
            </>
          )}

          {currentList && (
            <StoreSelector
              listId={listId}
              selectedStoreId={currentList.storeId ?? null}
            />
          )}

          <Pressable style={styles.archiveButton} onPress={handleArchive}>
            <Text style={styles.archiveButtonText}>Archive list</Text>
          </Pressable>
        </View>

        <AddItemForm listId={listId} />

        {!items && <Text style={styles.info}>Loading items...</Text>}

        {items && items.length === 0 && (
          <Text style={styles.info}>This list has no items yet.</Text>
        )}

        {items && (
          <FlatList
            data={items}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isEditing = editingItemId === item._id;

              if (isEditing) {
                return (
                  <View style={styles.editCard}>
                    <TextInput
                      value={editingName}
                      onChangeText={setEditingName}
                      placeholder="Item name"
                      style={styles.input}
                    />

                    <View style={styles.editRow}>
                      <TextInput
                        value={editingQuantity}
                        onChangeText={setEditingQuantity}
                        placeholder="Qty"
                        keyboardType="numeric"
                        style={[styles.input, styles.smallInput]}
                      />
                      <TextInput
                        value={editingUnitPrice}
                        onChangeText={setEditingUnitPrice}
                        placeholder="Unit price"
                        keyboardType="numeric"
                        style={[styles.input, styles.smallInput]}
                      />
                    </View>

                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={cancelEditing}
                      >
                        <Text style={styles.secondaryButtonText}>Cancel</Text>
                      </Pressable>

                      <Pressable
                        style={styles.primaryButton}
                        onPress={saveEditing}
                      >
                        <Text style={styles.primaryButtonText}>Save</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }

              return (
                <View
                  style={[
                    styles.itemCard,
                    item.checked && styles.itemCardChecked,
                  ]}
                >
                  <Pressable onPress={() => toggleChecked({ id: item._id })}>
                    <View style={styles.itemRow}>
                      <Text
                        style={[
                          styles.itemName,
                          item.checked && styles.itemNameChecked,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.itemQty}>
                        {item.quantity} {item.unit ?? ""}
                      </Text>
                    </View>

                    <View style={styles.itemRow}>
                      <Text style={styles.itemMeta}>
                        {Number(item.unitPrice ?? 0).toFixed(2)} €
                      </Text>
                      <Text style={styles.itemMeta}>
                        Line total:{" "}
                        {(
                          Number(item.quantity ?? 0) *
                          Number(item.unitPrice ?? 0)
                        ).toFixed(2)}{" "}
                        €
                      </Text>
                    </View>

                    {!!item.promo && (
                      <Text style={styles.promo}>Promo: {item.promo}</Text>
                    )}
                  </Pressable>

                  <View style={styles.actionsRow}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => startEditing(item)}
                    >
                      <Text style={styles.secondaryButtonText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => removeItem({ id: item._id })}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  headerBlock: {
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  info: {
    fontSize: 15,
    color: "#666",
  },
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#fafafa",
    marginBottom: 12,
    gap: 10,
  },
  itemCardChecked: {
    opacity: 0.65,
  },
  editCard: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#f7f7f7",
    marginBottom: 12,
    gap: 10,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  itemName: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
  },
  itemNameChecked: {
    textDecorationLine: "line-through",
  },
  itemQty: {
    fontSize: 14,
    color: "#555",
  },
  itemMeta: {
    marginTop: 8,
    color: "#666",
  },
  promo: {
    marginTop: 8,
    fontSize: 13,
    color: "#0a7",
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
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
  editRow: {
    flexDirection: "row",
    gap: 10,
  },
  smallInput: {
    flex: 1,
  },
  archiveButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  archiveButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#e9e9e9",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#222",
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#fbe4e4",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  deleteButtonText: {
    color: "#b42318",
    fontWeight: "600",
  },
});
