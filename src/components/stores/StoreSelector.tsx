import { useMutation, useQuery } from "convex/react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../../convex/_generated/api";

type StoreSelectorProps = {
  listId: any;
  selectedStoreId?: string | null;
};

export function StoreSelector({ listId, selectedStoreId }: StoreSelectorProps) {
  const stores = useQuery(api.stores.list);
  const setStore = useMutation(api.lists.setStore);

  const handleSelect = async (storeId?: string) => {
    await setStore({
      id: listId,
      storeId: storeId as any,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Store</Text>

      {!stores && <Text style={styles.info}>Loading stores...</Text>}

      {stores && stores.length === 0 && (
        <Text style={styles.info}>No stores available yet.</Text>
      )}

      {stores && stores.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Pressable
            style={[styles.chip, !selectedStoreId && styles.chipSelected]}
            onPress={() => handleSelect(undefined)}
          >
            <Text
              style={[
                styles.chipText,
                !selectedStoreId && styles.chipTextSelected,
              ]}
            >
              No store
            </Text>
          </Pressable>

          {stores.map((store) => {
            const selected = selectedStoreId === store._id;

            return (
              <Pressable
                key={store._id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => handleSelect(store._id)}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {store.favorite ? "★ " : ""}
                  {store.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
  info: {
    fontSize: 14,
    color: "#666",
  },
  scrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  chipSelected: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  chipText: {
    color: "#222",
    fontWeight: "500",
  },
  chipTextSelected: {
    color: "#fff",
  },
});
