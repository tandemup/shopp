import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import { useNavigation } from "@react-navigation/native";

import getDaysSinceJanuary1 from "../utils/helpers/newListName";
import validarNombreListaEnTiempoReal from "../utils/validation";
import { normalizarNombre } from "../utils/normalize";
import { safeAlert } from "../utils/core/safeAlert";

import { useLists } from "../context/ListsContext";
import { ROUTES } from "../navigation/ROUTES";
import { DEFAULT_CURRENCY } from "../constants/currency";
import CurrencyBadge from "../components/CurrencyBadge";

/* -------------------------------------------------
   Screen
-------------------------------------------------- */
export default function ShoppingListsScreen() {
  const navigation = useNavigation();

  /* =====================================================
     Estado global (LISTAS)
  ===================================================== */
  const {
    activeLists = [],
    archivedLists = [],
    createList,
    deleteList,
    archiveList,
  } = useLists();

  const [name, setName] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [nameError, setNameError] = useState(null);
  const [isNameValid, setIsNameValid] = useState(false);

  const overlayRef = useRef(null);

  /* =====================================================
     Header
  ===================================================== */
  useEffect(() => {
    navigation.setOptions({
      title: "Shopping Lists",
      headerTitleAlign: "center",
      headerShadowVisible: true,
    });
  }, [navigation]);

  /* =====================================================
     Crear nueva lista
  ===================================================== */
  const handleAddList = () => {
    if (!isNameValid) return;

    const nombreNormalizado = normalizarNombre(name, "-");
    createList(nombreNormalizado, DEFAULT_CURRENCY);

    setName("");
    setNameError(null);
    setIsNameValid(false);
  };

  /* =====================================================
     Abrir lista
  ===================================================== */
  const handleOpenList = (listId) => {
    if (!activeLists.find((l) => l.id === listId)) return;
    navigation.navigate(ROUTES.SHOPPING_LIST, { listId });
  };

  /* =====================================================
     Menú contextual
  ===================================================== */
  const openContextMenu = (list, event) => {
    if (Platform.OS === "web") {
      if (!event?.currentTarget) return;

      const rect = event.currentTarget.getBoundingClientRect();

      setContextMenu({
        list,
        x: rect.right - 160,
        y: rect.bottom + 6,
      });
    } else {
      safeAlert(
        "Opciones de la lista",
        `¿Qué deseas hacer con "${list.name}"?`,
        [
          {
            text: "Archivar",
            onPress: () => {
              archiveList(list.id);
              navigation.navigate(ROUTES.ARCHIVED_LISTS);
            },
          },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => deleteList(list.id),
          },
          {
            text: "Cancelar",
            style: "cancel",
          },
        ],
      );
    }
  };

  /* =====================================================
     Render item
  ===================================================== */
  const renderItem = ({ item }) => {
    const currency = item.currency ?? DEFAULT_CURRENCY;

    return (
      <Pressable style={styles.card} onPress={() => handleOpenList(item.id)}>
        <View style={styles.cardHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <CurrencyBadge currency={currency} size="sm" />
          </View>

          <Pressable onPress={(e) => openContextMenu(item, e)} hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={20} color="#555" />
          </Pressable>
        </View>

        <Text style={styles.date}>
          Creada el {new Date(item.createdAt).toLocaleDateString()}
        </Text>

        <Text style={styles.count}>{item.items?.length || 0} productos</Text>
      </Pressable>
    );
  };

  /* =====================================================
     Render
  ===================================================== */
  const sortedActiveLists = [...activeLists].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mis Listas</Text>

      {/* -------- Nueva lista -------- */}
      <View style={{ marginBottom: 20 }}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Nueva lista..."
            placeholderTextColor="#999"
            value={name}
            onChangeText={(text) => {
              setName(text);

              const resultado = validarNombreListaEnTiempoReal(
                text,
                activeLists,
                archivedLists,
              );

              setIsNameValid(resultado.valido);
              setNameError(resultado.mensaje);
            }}
          />

          <Pressable
            style={[styles.addButton, { opacity: isNameValid ? 1 : 0.4 }]}
            disabled={!isNameValid}
            onPress={handleAddList}
          >
            <Entypo name="add-to-list" size={24} color="green" />
          </Pressable>
        </View>

        {/* ---- Label de validación siempre visible ---- */}
        {name.trim().length > 0 && (
          <Text
            style={{
              marginTop: 3,
              marginLeft: 4,
              fontSize: 14,
              color: isNameValid ? "#16A34A" : "#DC2626",
              fontWeight: "600",
            }}
          >
            {isNameValid
              ? "✔ El nombre está disponible"
              : nameError || "✖ El nombre ya existe"}
          </Text>
        )}
      </View>

      {/* -------- Listado -------- */}
      <FlatList
        data={sortedActiveLists}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tienes listas activas 😊</Text>
        }
      />

      {/* -------- Menú contextual Web -------- */}
      {contextMenu && Platform.OS === "web" && (
        <Pressable
          ref={overlayRef}
          style={styles.overlay}
          onPress={() => {
            overlayRef.current?.blur?.();
            setContextMenu(null);
          }}
        >
          <View
            style={[
              styles.contextMenu,
              { top: contextMenu.y, left: contextMenu.x },
            ]}
          >
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                overlayRef.current?.blur?.();
                archiveList(contextMenu.list.id);
                setContextMenu(null);
                navigation.navigate(ROUTES.ARCHIVED_LISTS);
              }}
            >
              <Text style={styles.menuText}>Archivar</Text>
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                overlayRef.current?.blur?.();
                deleteList(contextMenu.list.id);
                setContextMenu(null);
              }}
            >
              <Text style={[styles.menuText, { color: "#dc2626" }]}>
                Eliminar
              </Text>
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                overlayRef.current?.blur?.();
                setContextMenu(null);
              }}
            >
              <Text style={styles.menuText}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 16,
    color: "#000",
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  input: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    fontSize: 16,
  },

  addButton: {
    marginLeft: 12,
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "green",
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#BFD7FF",
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },

  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },

  date: {
    fontSize: 13,
    color: "#6B7280",
  },

  count: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },

  emptyText: {
    marginTop: 40,
    textAlign: "center",
    color: "#888",
    fontSize: 14,
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },

  contextMenu: {
    position: "fixed",
    backgroundColor: "#fff",
    borderRadius: 10,
    minWidth: 160,
    paddingVertical: 6,
    zIndex: 1000,
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  },

  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  menuText: {
    fontSize: 15,
    color: "#111",
  },
});
