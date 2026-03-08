// components/SearchBarBasic.js
import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SearchBarBasic({
  placeholder = "Buscar producto...",
  onTextChange,
  onSubmit,
  onSelectSuggestion,
  suggestions = [],
}) {
  const [text, setText] = useState("");

  const handleChange = (value) => {
    setText(value);
    onTextChange?.(value);
  };

  return (
    <View style={styles.container}>
      {/* 🔍 INPUT */}
      <View style={styles.inputWrapper}>
        <Ionicons
          name="search"
          size={18}
          color="#666"
          style={{ marginRight: 6 }}
        />

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#999"
          value={text}
          onChangeText={handleChange}
          returnKeyType="done"
          onSubmitEditing={() => onSubmit?.(text)}
        />

        {/* ＋ botón para crear */}
        {!!text.trim() && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onSubmit?.(text)}
          >
            <Text style={styles.addButtonText}>＋</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 📋 SUGERENCIAS */}
      {suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.id}
          style={styles.suggestionsBox}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => onSelectSuggestion(item)}
            >
              <Text style={styles.suggestionText}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    marginTop: 12,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  input: {
    flex: 1,
    fontSize: 16,
  },

  addButton: {
    backgroundColor: "#4CAF50",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  addButtonText: {
    color: "white",
    fontSize: 22,
    fontWeight: "600",
    marginTop: -2,
  },

  suggestionsBox: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    maxHeight: 200,
  },

  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  suggestionText: {
    fontSize: 16,
  },
});
