import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  onAdd?: (name: string) => void;
};

export default function SearchCombinedBar({ onAdd }: Props) {
  const [query, setQuery] = useState("");

  const suggestions = [
    "milk",
    "bread",
    "eggs",
    "apples",
    "orange juice",
    "coffee",
  ];

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(query.toLowerCase()),
  );

  function addProduct(name: string) {
    setQuery("");
    onAdd?.(name);
  }

  return (
    <View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#999" />

        <TextInput
          placeholder="Buscar producto (actual o histórico)…"
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (query.trim().length === 0) return;
            addProduct(query.trim());
          }}
        />

        <Pressable style={styles.scanButton}>
          <Ionicons name="barcode-outline" size={18} color="#2563eb" />
        </Pressable>
      </View>

      {query.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i}
          style={styles.suggestions}
          renderItem={({ item }) => (
            <Pressable
              style={styles.suggestionRow}
              onPress={() => addProduct(item)}
            >
              <Ionicons name="time-outline" size={16} color="#888" />

              <Text style={styles.suggestionText}>{item}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 42,
    marginBottom: 10,
  },

  input: {
    flex: 1,
    marginLeft: 8,
  },

  scanButton: {
    padding: 6,
  },

  suggestions: {
    backgroundColor: "white",
    borderRadius: 10,
    marginTop: -8,
  },

  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },

  suggestionText: {
    marginLeft: 8,
  },
});
