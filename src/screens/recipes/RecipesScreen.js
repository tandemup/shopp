import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { I18nText as Text } from "@/src/i18n";
import { safeAlert, safeConfirm } from "@/src/components/ui/alert/safeAlert";
import { parseYouTubeUrl } from "@/src/services/urlSafety";
import {
  buildRecipesExport,
  loadRecipes,
  normalizeRecipe,
  parseRecipesImport,
  saveRecipes,
} from "@/src/services/recipesStorage";

const EMPTY_RECIPE = {
  title: "",
  youtubeUrl: "",
  productTags: [],
  category: "",
  budget: "económica",
  servings: "",
  minutes: "",
  notes: "",
};

const tagText = (tags) => (tags || []).join(", ");

function downloadJson(filename, payload) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_RECIPE);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRecipes(await loadRecipes());
    } catch (error) {
      safeAlert("Recetas", "No se pudieron leer las recetas guardadas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredRecipes = useMemo(() => {
    const terms = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    if (!terms) return recipes;
    return recipes.filter((recipe) =>
      [recipe.title, recipe.category, recipe.notes, ...(recipe.productTags || [])]
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(terms),
    );
  }, [query, recipes]);

  const openNew = () => {
    setEditingId(null);
    setDraft(EMPTY_RECIPE);
    setModalVisible(true);
  };

  const openEdit = (recipe) => {
    setEditingId(recipe.id);
    setDraft({ ...recipe, servings: recipe.servings || "", minutes: recipe.minutes || "" });
    setModalVisible(true);
  };

  const persist = async (nextRecipes) => {
    const saved = await saveRecipes(nextRecipes);
    setRecipes(saved);
  };

  const save = async () => {
    const title = String(draft.title || "").trim();
    if (!title) return safeAlert("Título requerido", "Escribe el nombre de la receta.");
    const youtubeUrl = String(draft.youtubeUrl || "").trim();
    if (youtubeUrl && !parseYouTubeUrl(youtubeUrl).isValid) {
      return safeAlert("Enlace no válido", "Introduce un vídeo o una playlist de YouTube válida.");
    }
    setSaving(true);
    try {
      const previous = recipes.find((recipe) => recipe.id === editingId);
      const recipe = normalizeRecipe({
        ...draft,
        id: editingId || undefined,
        productTags: String(draft.productTags || "").split(","),
        createdAt: previous?.createdAt,
        updatedAt: Date.now(),
      });
      await persist(editingId
        ? recipes.map((item) => (item.id === editingId ? recipe : item))
        : [recipe, ...recipes]);
      setModalVisible(false);
    } catch (error) {
      safeAlert("Recetas", "No se pudo guardar la receta.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (recipe) => safeConfirm(
    "Eliminar receta",
    `¿Quieres eliminar «${recipe.title}»?`,
    () => persist(recipes.filter((item) => item.id !== recipe.id)),
    { confirmText: "Eliminar", destructive: true },
  );

  const openVideo = async (recipe) => {
    if (!recipe.youtubeUrl) {
      safeAlert("Sin vídeo", "Esta receta no tiene un enlace de YouTube.");
      return;
    }
    await Linking.openURL(recipe.youtubeUrl);
  };

  const exportRecipes = async () => {
    const payload = buildRecipesExport(recipes);
    const filename = "shopp-recetas-saludables.json";
    if (Platform.OS === "web" && typeof document !== "undefined") {
      downloadJson(filename, payload);
      return;
    }
    await Share.share({ title: filename, message: JSON.stringify(payload, null, 2) });
  };

  const importRecipes = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      const incoming = parseRecipesImport(JSON.parse(await (await fetch(asset.uri)).text()));
      const byTitle = new Map(recipes.map((recipe) => [recipe.title.toLocaleLowerCase("es"), recipe]));
      incoming.forEach((recipe) => byTitle.set(recipe.title.toLocaleLowerCase("es"), recipe));
      await persist([...byTitle.values()].sort((a, b) => b.updatedAt - a.updatedAt));
      safeAlert("Recetas importadas", `${incoming.length} receta${incoming.length === 1 ? "" : "s"} procesada${incoming.length === 1 ? "" : "s"}.`);
    } catch (error) {
      safeAlert("No se pudo importar", error?.message || "Revisa el fichero JSON.");
    }
  };

  const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Recetas saludables</Text>
          <Text style={styles.subtitle}>Ideas asequibles para tu compra del supermercado.</Text>
        </View>
        <Pressable style={styles.addButton} onPress={openNew}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por receta o producto…"
        placeholderTextColor="#64748b"
        style={styles.search}
      />
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={importRecipes}><Text style={styles.actionText}>Importar JSON</Text></Pressable>
        <Pressable style={styles.action} onPress={exportRecipes}><Text style={styles.actionText}>Exportar JSON</Text></Pressable>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color="#15803d" /></View> : (
        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="nutrition-outline" size={44} color="#94a3b8" /><Text style={styles.emptyTitle}>Todavía no hay recetas</Text><Text style={styles.emptyText}>Guarda vídeos de cocina saludable y anota los productos que compras.</Text></View>}
          renderItem={({ item }) => <View style={styles.card}>
            <View style={styles.cardTop}><View style={styles.cardCopy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.category || "Supermercado"} · {item.budget === "económica" ? "Económica" : "Coste medio"}</Text></View><Pressable onPress={() => openEdit(item)}><Ionicons name="create-outline" size={21} color="#2563eb" /></Pressable></View>
            {item.productTags?.length ? <Text style={styles.tags}>Productos: {tagText(item.productTags)}</Text> : null}
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
            <View style={styles.cardActions}><Pressable onPress={() => openVideo(item)} style={[styles.cardButton, !item.youtubeUrl && styles.cardButtonDisabled]}><Ionicons name="logo-youtube" size={18} color="#fff" /><Text style={styles.cardButtonText}>Ver receta</Text></Pressable><Pressable onPress={() => remove(item)} style={styles.deleteButton}><Ionicons name="trash-outline" size={19} color="#dc2626" /></Pressable></View>
          </View>}
        />
      )}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modal}><Text style={styles.modalTitle}>{editingId ? "Editar receta" : "Nueva receta"}</Text>
          <TextInput value={draft.title} onChangeText={(value) => setField("title", value)} placeholder="Nombre de la receta" placeholderTextColor="#64748b" style={styles.input} />
          <TextInput value={draft.youtubeUrl} onChangeText={(value) => setField("youtubeUrl", value)} placeholder="Enlace de YouTube (opcional)" placeholderTextColor="#64748b" autoCapitalize="none" style={styles.input} />
          <TextInput value={draft.productTags instanceof Array ? tagText(draft.productTags) : draft.productTags} onChangeText={(value) => setField("productTags", value)} placeholder="Productos: arroz, garbanzos, tomate" placeholderTextColor="#64748b" style={styles.input} />
          <TextInput value={draft.category} onChangeText={(value) => setField("category", value)} placeholder="Categoría: legumbres, verduras…" placeholderTextColor="#64748b" style={styles.input} />
          <View style={styles.inline}><TextInput value={String(draft.servings || "")} onChangeText={(value) => setField("servings", value)} keyboardType="number-pad" placeholder="Raciones" placeholderTextColor="#64748b" style={[styles.input, styles.smallInput]} /><TextInput value={String(draft.minutes || "")} onChangeText={(value) => setField("minutes", value)} keyboardType="number-pad" placeholder="Minutos" placeholderTextColor="#64748b" style={[styles.input, styles.smallInput]} /></View>
          <TextInput value={draft.notes} onChangeText={(value) => setField("notes", value)} placeholder="Notas personales" placeholderTextColor="#64748b" multiline style={[styles.input, styles.notesInput]} />
          <View style={styles.modalActions}><Pressable onPress={() => setModalVisible(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable disabled={saving} onPress={save} style={styles.save}><Text style={styles.saveText}>{saving ? "Guardando…" : "Guardar"}</Text></Pressable></View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc", padding: 16 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }, headerCopy: { flex: 1 }, title: { color: "#172033", fontSize: 24, fontWeight: "800" }, subtitle: { color: "#64748b", fontSize: 14, lineHeight: 20, marginTop: 3 }, addButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#15803d" }, search: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe3ee", borderRadius: 12, minHeight: 46, paddingHorizontal: 14, color: "#172033" }, actions: { flexDirection: "row", gap: 10, marginVertical: 12 }, action: { backgroundColor: "#eaf7ee", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }, actionText: { color: "#166534", fontSize: 13, fontWeight: "700" }, list: { paddingBottom: 28, gap: 12 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, padding: 14 }, cardTop: { flexDirection: "row", gap: 12 }, cardCopy: { flex: 1 }, cardTitle: { color: "#172033", fontSize: 17, fontWeight: "800" }, meta: { color: "#15803d", fontSize: 13, fontWeight: "700", marginTop: 3 }, tags: { color: "#475569", fontSize: 13, lineHeight: 19, marginTop: 10 }, notes: { color: "#64748b", fontSize: 13, lineHeight: 19, marginTop: 7 }, cardActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 13 }, cardButton: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#dc2626", paddingHorizontal: 12, minHeight: 36, borderRadius: 9 }, cardButtonDisabled: { backgroundColor: "#94a3b8" }, cardButtonText: { color: "#fff", fontWeight: "800", fontSize: 13 }, deleteButton: { padding: 8 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, empty: { alignItems: "center", paddingHorizontal: 30, paddingTop: 80 }, emptyTitle: { color: "#172033", fontSize: 18, fontWeight: "800", marginTop: 12 }, emptyText: { color: "#64748b", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 7 }, modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 23, 42, 0.42)" }, modal: { maxHeight: "92%", backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 }, modalTitle: { color: "#172033", fontSize: 21, fontWeight: "800", marginBottom: 14 }, input: { minHeight: 45, borderWidth: 1, borderColor: "#dbe3ee", borderRadius: 10, paddingHorizontal: 12, color: "#172033", marginBottom: 10 }, inline: { flexDirection: "row", gap: 10 }, smallInput: { flex: 1 }, notesInput: { minHeight: 80, paddingTop: 10, textAlignVertical: "top" }, modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 }, cancel: { paddingHorizontal: 15, paddingVertical: 11 }, cancelText: { color: "#475569", fontWeight: "700" }, save: { backgroundColor: "#15803d", paddingHorizontal: 17, paddingVertical: 11, borderRadius: 10 }, saveText: { color: "#fff", fontWeight: "800" },
});
