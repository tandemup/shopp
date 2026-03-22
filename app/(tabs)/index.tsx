import { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ListCard from "@/src/components/lists/ListCard";
import { actionSheet } from "@/src/components/ui/dialog/dialog";
import { useLists } from "@/src/context/ListsContext";

export default function ShoppingListsScreen() {
  const router = useRouter();
  const { lists, addList, deleteList, archiveList, updateList } = useLists();
  const [name, setName] = useState("");

  /* -------------------------------------------------
     Crear nueva lista
  -------------------------------------------------- */

  const handleAddList = () => {
    if (!name.trim()) return;

    addList(name.trim());
    setName("");
  };

  /* -------------------------------------------------
     Abrir lista
  -------------------------------------------------- */

  const handleOpenList = (id: string) => {
    router.push(`/list/${id}`);
  };

  /* -------------------------------------------------
     Editar lista
  -------------------------------------------------- */
  const handleEditList = async (list: any) => {
    const newName = await prompt(
      "Editar nombre",
      "Introduce el nuevo nombre",
      list.name,
    );

    if (!newName || !newName.trim()) return;

    updateList(list.id, {
      name: newName.trim(),
    });
  };
  /* -------------------------------------------------
     Menú contextual
  -------------------------------------------------- */
  const openMenu = async (list: any) => {
    const index = await actionSheet(list.name, [
      { text: "Abrir" }, // 0
      { text: "Archivar" }, // 1
      { text: "Editar nombre" }, // 2
      { text: "Eliminar", style: "destructive" }, // 3
      { text: "Cancelar", style: "cancel" }, // 4
    ]);

    if (index === 0) {
      handleOpenList(list.id);
    } else if (index === 1) {
      archiveList?.(list.id);
    } else if (index === 2) {
      handleEditList(list);
    } else if (index === 3) {
      deleteList?.(list.id);
    }
  };
  /* -------------------------------------------------
     Ordenar listas
  -------------------------------------------------- */

  const sortedLists = [...lists].sort(
    (a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  /* -------------------------------------------------
     Render
  -------------------------------------------------- */

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Mis listas</Text>

        {/* -------- Nueva lista -------- */}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Nueva lista..."
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            onSubmitEditing={handleAddList}
          />

          <Pressable style={styles.addButton} onPress={handleAddList}>
            <Ionicons name="add" size={22} color="#16a34a" />
          </Pressable>
        </View>

        {/* -------- Listado -------- */}

        <FlatList
          keyboardShouldPersistTaps="handled"
          data={sortedLists}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListCard
              list={item}
              onPress={() => handleOpenList(item.id)}
              onMenu={() => openMenu(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No hay listas todavía</Text>
              <Text style={styles.emptyText}>
                Crea una lista para empezar a usar Shopp.
              </Text>
            </View>
          }
          contentContainerStyle={
            lists.length === 0 ? styles.emptyContent : undefined
          }
        />
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f7fb",
  },

  container: {
    flex: 1,
    padding: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
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
    borderColor: "#e5e7eb",
    fontSize: 16,
  },

  addButton: {
    marginLeft: 10,
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },

  emptyText: {
    color: "#6b7280",
    lineHeight: 20,
  },
});
