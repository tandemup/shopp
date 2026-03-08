import React, { useMemo, useState, useRef } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import { useStores } from "../context/StoresContext";
import { useLists } from "../context/ListsContext";
import { normalizeProductName } from "../utils/normalize";

/* -------------------------------------------------
   Badge
-------------------------------------------------- */
const Badge = ({ label, color }) => (
  <View
    style={[
      styles.badge,
      { backgroundColor: color + "20", borderColor: color },
    ]}
  >
    <Text style={[styles.badgeText, { color }]}>{label}</Text>
  </View>
);

/* -------------------------------------------------
   Component
-------------------------------------------------- */
export default function SearchCombinedBar({
  currentList,
  onAddFromHistory,
  onCreateNew,
}) {
  const inputRef = useRef(null);

  // 🛡 Contextos protegidos
  const { purchaseHistory = [] } = useLists();
  const { getStoreById } = useStores();

  // 🛡 Lista segura
  const safeCurrentList = currentList ?? {};

  const [query, setQuery] = useState("");

  /* -------------------------------------------------
     Suggestions (seguro ante datos incompletos)
  -------------------------------------------------- */
  const suggestions = useMemo(() => {
    // ⛔ Sin lista activa → no sugerir historial
    if (!safeCurrentList.id) return [];

    const q = normalizeProductName(query);
    if (!q) return [];

    return purchaseHistory
      .filter((e) => {
        // 🔒 Normalización segura (evita includes sobre undefined)
        const normalized =
          e.normalizedName ?? normalizeProductName(e.name ?? "");

        if (!normalized.includes(q)) return false;

        // 🏬 Filtro por tienda (si aplica)
        if (safeCurrentList.storeId) {
          return e.storeId === safeCurrentList.storeId;
        }

        return true;
      })
      .sort((a, b) => {
        if (b.frequency !== a.frequency) {
          return b.frequency - a.frequency;
        }
        return b.lastPurchasedAt - a.lastPurchasedAt;
      })
      .slice(0, 8)
      .map((e) => ({
        id: e.id,
        type: "history",
        name: e.name,
        priceInfo: e.priceInfo ?? null,
        storeId: e.storeId ?? null,
      }));
  }, [query, purchaseHistory, safeCurrentList.id, safeCurrentList.storeId]);

  const showCreate =
    query.trim().length > 0 &&
    !suggestions.some(
      (s) =>
        normalizeProductName(s.name) === normalizeProductName(query.trim()),
    );

  /* -------------------------------------------------
     Selection handler
  -------------------------------------------------- */
  const handleSelect = (item) => {
    inputRef.current?.blur();

    if (item.type === "create") {
      onCreateNew?.(item.name);
      setQuery("");
      return;
    }

    if (item.type === "history") {
      onAddFromHistory?.({
        name: item.name,
        priceInfo: item.priceInfo ?? null,
      });
      setQuery("");
    }
  };

  /* -------------------------------------------------
     Render
  -------------------------------------------------- */
  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="🔍 Buscar producto (actual o histórico)…"
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => {
          if (query.trim()) {
            onCreateNew?.(query.trim());
            setQuery("");
          }
        }}
        returnKeyType="done"
      />

      {(suggestions.length > 0 || showCreate) && (
        <FlatList
          style={styles.resultsBox}
          data={[
            ...suggestions,
            ...(showCreate
              ? [{ id: "create", type: "create", name: query.trim() }]
              : []),
          ]}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            if (item.type === "create") {
              return (
                <TouchableOpacity
                  style={[styles.resultRow, styles.createRow]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.createText}>➕ Crear "{item.name}"</Text>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                style={[styles.resultRow, styles.historyRow]}
                onPress={() => handleSelect(item)}
              >
                {/* Badge */}
                <View style={styles.badgesRow}>
                  <Badge label="HIST" color="#2563eb" />
                </View>

                {/* Nombre */}
                <Text style={styles.itemName}>{item.name}</Text>

                {/* Meta */}
                <View style={styles.metaRow}>
                  {item.priceInfo?.total != null && (
                    <Text style={styles.metaText}>
                      💰 {item.priceInfo.total.toFixed(2)} €
                    </Text>
                  )}

                  {item.storeId && (
                    <Text style={styles.metaText}>
                      🏬 {getStoreById(item.storeId)?.name ?? "Tienda"}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 30,
    marginHorizontal: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    marginBottom: 6,
    fontSize: 15,
  },
  resultsBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderColor: "#ddd",
    borderWidth: 1,
    maxHeight: 300,
  },
  resultRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  historyRow: { backgroundColor: "#f9fafb" },
  createRow: { backgroundColor: "#ecfeff" },
  createText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0ea5e9",
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 2,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
  },
  metaRow: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: "#555",
  },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
