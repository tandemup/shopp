import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import WebPreviewCard from "@/src/components/chat/WebPreviewCard";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const CLIENT_ID_KEY = "shopp-chat-client-id";
const UNCLASSIFIED_IMPORT_KEY = "__unclassified__";

function defaultBackupFilename() {
  const day = new Date().toISOString().slice(0, 10);
  return `shopp-biblioteca-${day}.json`;
}

function normalizeBackupFilename(value) {
  const cleanName = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");

  if (!cleanName) return "";
  return cleanName.toLowerCase().endsWith(".json")
    ? cleanName
    : `${cleanName}.json`;
}

function getBackupRootFolderKey(folderKey, folderByKey) {
  let folder = folderByKey.get(String(folderKey || ""));
  let remainingDepth = 20;

  while (folder?.parentKey && remainingDepth > 0) {
    folder = folderByKey.get(String(folder.parentKey));
    remainingDepth -= 1;
  }

  return folder?.key ? String(folder.key) : null;
}

function buildImportCategoryOptions(data) {
  const backupFolders = Array.isArray(data?.folders) ? data.folders : [];
  const backupLinks = Array.isArray(data?.links) ? data.links : [];
  const validFolders = backupFolders.filter(
    (folder) =>
      folder &&
      typeof folder.key === "string" &&
      typeof folder.name === "string" &&
      folder.key.trim() &&
      folder.name.trim(),
  );
  const folderByKey = new Map(
    validFolders.map((folder) => [String(folder.key), folder]),
  );
  const rootFolders = validFolders
    .filter((folder) => !folder.parentKey)
    .sort(
      (a, b) =>
        Number(a.order || 0) - Number(b.order || 0) ||
        String(a.name).localeCompare(String(b.name)),
    );
  const linkCounts = new Map(
    rootFolders.map((folder) => [String(folder.key), 0]),
  );
  let unclassifiedCount = 0;

  backupLinks.forEach((link) => {
    const rootKey = getBackupRootFolderKey(link?.folderKey, folderByKey);
    if (rootKey && linkCounts.has(rootKey)) {
      linkCounts.set(rootKey, linkCounts.get(rootKey) + 1);
    } else {
      unclassifiedCount += 1;
    }
  });

  const options = rootFolders.map((folder) => ({
    key: String(folder.key),
    name: String(folder.name).trim(),
    icon: folder.icon || "folder-outline",
    color: folder.color || "#475569",
    linkCount: linkCounts.get(String(folder.key)) || 0,
  }));

  if (unclassifiedCount > 0) {
    options.push({
      key: UNCLASSIFIED_IMPORT_KEY,
      name: "Sin categoría",
      icon: "file-tray-outline",
      color: "#64748b",
      linkCount: unclassifiedCount,
    });
  }

  return options;
}

function filterBackupByCategories(data, selectedCategoryKeys) {
  const folders = Array.isArray(data?.folders) ? data.folders : [];
  const links = Array.isArray(data?.links) ? data.links : [];
  const selectedKeys = new Set(selectedCategoryKeys || []);
  const folderByKey = new Map(
    folders
      .filter((folder) => folder && typeof folder.key === "string")
      .map((folder) => [String(folder.key), folder]),
  );

  const isSelectedFolder = (folderKey) => {
    const rootKey = getBackupRootFolderKey(folderKey, folderByKey);
    return Boolean(rootKey && selectedKeys.has(rootKey));
  };

  return {
    ...data,
    folders: folders.filter((folder) => isSelectedFolder(folder?.key)),
    links: links.filter((link) => {
      if (typeof link?.folderKey === "string" && link.folderKey.trim()) {
        return isSelectedFolder(link.folderKey);
      }
      return selectedKeys.has(UNCLASSIFIED_IMPORT_KEY);
    }),
  };
}

function ImportCheckbox({
  checked,
  label,
  detail,
  icon,
  color,
  onPress,
  disabled = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={({ pressed }) => [
        styles.importOption,
        checked && styles.importOptionChecked,
        pressed && styles.importOptionPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View
        style={[
          styles.importCheckbox,
          checked && styles.importCheckboxChecked,
        ]}
      >
        {checked ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
      </View>
      <Ionicons name={icon || "folder-outline"} size={18} color={color} />
      <View style={styles.importOptionText}>
        <Text style={styles.importOptionLabel}>{label}</Text>
        {detail ? <Text style={styles.importOptionDetail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

function getClientId() {
  if (typeof window !== "undefined") {
    const saved = window.localStorage?.getItem(CLIENT_ID_KEY);
    if (saved) return saved;
    const next = globalThis.crypto?.randomUUID?.() || `library-${Date.now()}`;
    window.localStorage?.setItem(CLIENT_ID_KEY, next);
    return next;
  }
  return `library-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function LibraryScreen({ navigation }) {
  const { width: screenWidth } = useWindowDimensions();
  const [clientId] = useState(getClientId);
  const [urlInput, setUrlInput] = useState("");
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [newsView, setNewsView] = useState("articles");
  const [movingLink, setMovingLink] = useState(null);
  const [editingLink, setEditingLink] = useState(null);
  const [notesInput, setNotesInput] = useState("");
  const [hashtagsInput, setHashtagsInput] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingSource, setEditingSource] = useState(null);
  const [sourceNameInput, setSourceNameInput] = useState("");
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [exportNameVisible, setExportNameVisible] = useState(false);
  const [exportFilename, setExportFilename] = useState("");
  const [exportReview, setExportReview] = useState(null);
  const [selectedExportCategoryKeys, setSelectedExportCategoryKeys] = useState(
    [],
  );
  const [importReview, setImportReview] = useState(null);
  const [selectedImportCategoryKeys, setSelectedImportCategoryKeys] = useState(
    [],
  );
  const [importMode, setImportMode] = useState("combine");

  const folders = useQuery(api.computerLinks.listFolders) || [];
  const libraryBackup = useQuery(api.computerLinks.exportBackup);
  const selectedFolderId = !["all", "favorites", "unclassified"].includes(
    folderFilter,
  )
    ? folderFilter
    : undefined;
  const selectedFolder = folders.find(
    (folder) => String(folder._id) === String(selectedFolderId),
  );
  const isNewsFolder = selectedFolder?.name === "Noticias";
  const isBooksFolder = selectedFolder?.name === "Libros";
  const isCatalogFolder = isNewsFolder || isBooksFolder;
  const isSourceCatalog = isCatalogFolder && newsView === "sources";
  const cardColumns = Math.max(
    1,
    Math.min(6, Math.floor((screenWidth - 20) / 270)),
  );
  const links = useQuery(api.computerLinks.list, {
    search: search.trim() || undefined,
    folderId: selectedFolderId,
    onlyFavorites: folderFilter === "favorites" || undefined,
    onlyUnclassified: folderFilter === "unclassified" || undefined,
    excludeNewsSources: folderFilter === "all" || undefined,
    linkType: isCatalogFolder
      ? newsView === "sources"
        ? isBooksFolder ? "bookStore" : "newsSource"
        : isBooksFolder ? "bookLink" : "newsArticle"
      : undefined,
  });

  const ensureDefaultFolders = useMutation(
    api.computerLinks.ensureDefaultFolders,
  );
  const syncFromChat = useMutation(api.computerLinks.syncFromChat);
  const addUrl = useMutation(api.computerLinks.addUrl);
  const createFolder = useMutation(api.computerLinks.createFolder);
  const toggleFavorite = useMutation(api.computerLinks.toggleFavorite);
  const updateMetadata = useMutation(api.computerLinks.updateMetadata);
  const updateNewsSource = useMutation(api.computerLinks.updateNewsSource);
  const moveToFolder = useMutation(api.computerLinks.moveToFolder);
  const removeLink = useMutation(api.computerLinks.remove);
  const removeNewsSource = useMutation(api.computerLinks.removeNewsSource);
  const importBackup = useMutation(api.computerLinks.importBackup);
  const normalizeAndDeduplicate = useMutation(
    api.computerLinks.normalizeAndDeduplicate,
  );

  useEffect(() => {
    ensureDefaultFolders({ clientId })
      .then(() => syncFromChat({ clientId }))
      .then(() => normalizeAndDeduplicate({}))
      .catch((error) => console.warn("[LibraryScreen] sync failed", error));
  }, [clientId, ensureDefaultFolders, normalizeAndDeduplicate, syncFromChat]);

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [String(folder._id), folder])),
    [folders],
  );

  const handleAddUrl = useCallback(async () => {
    const url = urlInput.trim();
    if (!url || saving) return;
    setSaving(true);
    try {
      const result = await addUrl({
        url,
        clientId,
        username: "Biblioteca",
        folderId: selectedFolderId,
        linkType: isCatalogFolder
          ? newsView === "sources"
            ? isBooksFolder ? "bookStore" : "newsSource"
            : isBooksFolder ? "bookLink" : "newsArticle"
          : "general",
      });
      setUrlInput("");
      if (result.existing) {
        safeAlert(
          "Enlace recuperado",
          "El enlace ya existía en la biblioteca.",
        );
      }
    } catch (error) {
      safeAlert(
        "URL no válida",
        error?.message || "No se pudo guardar el enlace.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    addUrl,
    clientId,
    isCatalogFolder,
    isBooksFolder,
    newsView,
    saving,
    selectedFolderId,
    urlInput,
  ]);

  const handleCreateFolder = useCallback(async () => {
    if (!folderName.trim() || saving) return;
    setSaving(true);
    try {
      const result = await createFolder({ name: folderName.trim(), clientId });
      setFolderName("");
      setCreatingFolder(false);
      setFolderFilter(String(result.folderId));
    } catch (error) {
      safeAlert("No se pudo crear", error?.message || "Revisa el nombre.");
    } finally {
      setSaving(false);
    }
  }, [clientId, createFolder, folderName, saving]);

  const handleMove = useCallback(
    async (folder) => {
      if (!movingLink?._id) return;
      try {
        await moveToFolder({
          linkId: movingLink._id,
          folderId: folder?._id,
        });
        setMovingLink(null);
      } catch (error) {
        safeAlert("Error", error?.message || "No se pudo mover el enlace.");
      }
    },
    [moveToFolder, movingLink],
  );

  const openMetadataEditor = useCallback((link) => {
    setEditingLink(link);
    setNotesInput(link?.notes || "");
    setHashtagsInput((link?.hashtags || []).map((tag) => `#${tag}`).join(" "));
  }, []);

  const openSourceEditor = useCallback((link) => {
    setEditingSource(link);
    setSourceNameInput(link?.customTitle || "");
    setSourceUrlInput(link?.normalizedUrl || link?.url || "");
  }, []);

  const handleSaveSource = useCallback(async () => {
    if (!editingSource?._id || !sourceUrlInput.trim() || saving) return;
    setSaving(true);
    try {
      await updateNewsSource({
        linkId: editingSource._id,
        url: sourceUrlInput.trim(),
        customTitle: sourceNameInput.trim() || undefined,
      });
      setEditingSource(null);
      setSourceNameInput("");
      setSourceUrlInput("");
    } catch (error) {
      safeAlert("No se pudo editar", error?.message || "Revisa la dirección.");
    } finally {
      setSaving(false);
    }
  }, [
    editingSource,
    saving,
    sourceNameInput,
    sourceUrlInput,
    updateNewsSource,
  ]);

  const openSourceUrl = useCallback(async (url) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      safeAlert("No se pudo abrir", error?.message || "Revisa la dirección.");
    }
  }, []);

  const confirmRemoveSource = useCallback(
    (source) => {
      safeAlert(
        isBooksFolder ? "Eliminar tienda" : "Eliminar periódico",
        `Se eliminará ${source.customTitle || source.hostname} y sus ${isBooksFolder ? "libros" : "noticias"} guardados.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                await removeNewsSource({ linkId: source._id });
              } catch (error) {
                safeAlert(
                  "No se pudo eliminar",
                  error?.message || "Inténtalo de nuevo.",
                );
              }
            },
          },
        ],
      );
    },
    [isBooksFolder, removeNewsSource],
  );

  const handleSaveMetadata = useCallback(async () => {
    if (!editingLink?._id || saving) return;
    setSaving(true);
    try {
      const hashtags = hashtagsInput
        .split(/[\s,;]+/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      await updateMetadata({
        linkId: editingLink._id,
        notes: notesInput,
        hashtags,
      });
      setEditingLink(null);
      setNotesInput("");
      setHashtagsInput("");
    } catch (error) {
      safeAlert("No se pudo guardar", error?.message || "Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [editingLink, hashtagsInput, notesInput, saving, updateMetadata]);

  const performExportBackup = useCallback(async () => {
    const filename = normalizeBackupFilename(exportFilename);
    if (!exportReview || backupBusy || !filename) return;

    const exportAll =
      exportReview.categories.length === 0 ||
      selectedExportCategoryKeys.length === exportReview.categories.length;
    const selectedData = exportAll
      ? exportReview.data
      : filterBackupByCategories(exportReview.data, selectedExportCategoryKeys);

    setExportNameVisible(false);
    setExportReview(null);
    setSelectedExportCategoryKeys([]);
    setBackupBusy(true);
    try {
      const payload = {
        format: "shopp-library-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        app: "Shopp",
        data: selectedData,
      };
      const json = JSON.stringify(payload, null, 2);

      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([json], {
          type: "application/json;charset=utf-8",
        });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } else {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        safeAlert(
          "Copia creada",
          `Se ha guardado ${filename} en el almacenamiento de Shopp.\n\n${fileUri}`,
        );
      }
    } catch (error) {
      safeAlert("No se pudo exportar", error?.message || "Inténtalo de nuevo.");
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, exportFilename, exportReview, selectedExportCategoryKeys]);

  const handleExportBackup = useCallback(() => {
    if (!libraryBackup || backupBusy) return;
    setExportFilename(defaultBackupFilename());
    const categories = buildImportCategoryOptions(libraryBackup);
    setExportReview({
      data: libraryBackup,
      categories,
      folderCount: libraryBackup.folders.length,
      linkCount: libraryBackup.links.length,
      sourceCount: libraryBackup.links.filter((link) =>
        ["newsSource", "bookStore"].includes(link?.linkType),
      ).length,
      savedLinkCount:
        libraryBackup.links.length -
        libraryBackup.links.filter((link) =>
          ["newsSource", "bookStore"].includes(link?.linkType),
        ).length,
    });
    setSelectedExportCategoryKeys(categories.map((category) => category.key));
    setExportNameVisible(true);
  }, [backupBusy, libraryBackup]);

  const handleImportSelected = useCallback(async () => {
    if (!importReview || backupBusy) return;

    const categoryKeys = selectedImportCategoryKeys;
    if (importReview.categories.length > 0 && categoryKeys.length === 0) {
      return;
    }

    const importAll =
      importReview.categories.length === 0 ||
      categoryKeys.length === importReview.categories.length;
    const importArgs = {
      clientId,
      backup: importReview.parsed,
      replaceExisting: importMode === "replace",
    };

    if (!importAll) {
      importArgs.categoryKeys = categoryKeys;
    }

    const executeImport = async () => {
      setImportReview(null);
      setSelectedImportCategoryKeys([]);
      setImportMode("combine");
      setBackupBusy(true);
      try {
        const summary = await importBackup(importArgs);
        safeAlert(
          "Biblioteca restaurada",
          `${importMode === "replace" ? "Reemplazo completado." : "Modo combinar completado."}\n\n${summary.linksDeleted ? `Enlaces eliminados: ${summary.linksDeleted}\n` : ""}${summary.foldersDeleted ? `Categorías eliminadas: ${summary.foldersDeleted}\n` : ""}Carpetas creadas: ${summary.foldersCreated}\nEnlaces creados: ${summary.linksCreated}\nEnlaces actualizados: ${summary.linksUpdated}`,
        );
      } catch (error) {
        safeAlert(
          "No se pudo importar",
          error?.message || "No se pudo modificar la Biblioteca.",
        );
      } finally {
        setBackupBusy(false);
      }
    };

    if (importMode === "replace") {
      safeAlert(
        "Reemplazar Biblioteca",
        `Se eliminarán todas las categorías y enlaces actuales y se conservarán únicamente los seleccionados del fichero ${importReview.fileName}. Esta acción no se puede deshacer.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Reemplazar", style: "destructive", onPress: executeImport },
        ],
      );
      return;
    }

    await executeImport();
  }, [
    backupBusy,
    clientId,
    importBackup,
    importMode,
    importReview,
    selectedImportCategoryKeys,
  ]);

  const handleImportBackup = useCallback(async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri)
        throw new Error("No se pudo leer el fichero seleccionado.");

      let jsonText = "";
      if (Platform.OS === "web" && asset.file) {
        jsonText = await asset.file.text();
      } else {
        jsonText = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      const parsed = JSON.parse(jsonText);
      if (parsed?.format !== "shopp-library-backup" || parsed?.version !== 1) {
        throw new Error("El fichero no es una copia de Biblioteca compatible.");
      }
      if (
        !parsed?.data ||
        !Array.isArray(parsed.data.folders) ||
        !Array.isArray(parsed.data.links)
      ) {
        throw new Error("La copia está incompleta: faltan carpetas o enlaces.");
      }

      const folderCount = parsed.data.folders.length;
      const linkCount = parsed.data.links.length;
      const sourceCount = parsed.data.links.filter((link) =>
        ["newsSource", "bookStore"].includes(link?.linkType),
      ).length;
      const savedLinkCount = linkCount - sourceCount;
      const categories = buildImportCategoryOptions(parsed.data);
      setImportReview({
        fileName: asset.name || "copia de Biblioteca",
        parsed,
        categories,
        folderCount,
        linkCount,
        sourceCount,
        savedLinkCount,
      });
      setSelectedImportCategoryKeys(categories.map((category) => category.key));
      setImportMode("combine");
    } catch (error) {
      if (String(error?.name || "") === "SyntaxError") {
        safeAlert(
          "JSON no válido",
          "El fichero seleccionado no contiene JSON válido.",
        );
      } else {
        safeAlert(
          "No se pudo importar",
          error?.message || "Revisa la copia de seguridad.",
        );
      }
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy]);

  const importCategories = importReview?.categories || [];
  const allImportCategoriesSelected =
    importCategories.length === 0 ||
    selectedImportCategoryKeys.length === importCategories.length;

  const closeImportReview = useCallback(() => {
    if (backupBusy) return;
    setImportReview(null);
    setSelectedImportCategoryKeys([]);
    setImportMode("combine");
  }, [backupBusy]);

  const toggleImportCategory = useCallback((categoryKey) => {
    setSelectedImportCategoryKeys((current) =>
      current.includes(categoryKey)
        ? current.filter((key) => key !== categoryKey)
        : [...current, categoryKey],
    );
  }, []);

  const exportCategories = exportReview?.categories || [];
  const allExportCategoriesSelected =
    exportCategories.length === 0 ||
    selectedExportCategoryKeys.length === exportCategories.length;
  const selectedExportLinkCount = allExportCategoriesSelected
    ? exportReview?.linkCount || 0
    : exportCategories
        .filter((category) => selectedExportCategoryKeys.includes(category.key))
        .reduce((total, category) => total + category.linkCount, 0);

  const closeExportReview = useCallback(() => {
    if (backupBusy) return;
    setExportNameVisible(false);
    setExportReview(null);
    setSelectedExportCategoryKeys([]);
  }, [backupBusy]);

  const toggleExportCategory = useCallback((categoryKey) => {
    setSelectedExportCategoryKeys((current) =>
      current.includes(categoryKey)
        ? current.filter((key) => key !== categoryKey)
        : [...current, categoryKey],
    );
  }, []);

  const topFolders = folders.filter((folder) => !folder.parentFolderId);
  const filters = [
    { _id: "all", name: "Todos", icon: "apps-outline" },
    { _id: "favorites", name: "Favoritos", icon: "star-outline" },
    { _id: "unclassified", name: "Sin clasificar", icon: "file-tray-outline" },
    ...topFolders,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.compactTopBar}>
          <Pressable
            onPress={() => navigation?.goBack()}
            style={styles.compactTopButton}
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={20} color="#334155" />
          </Pressable>
          <View style={styles.compactTopTitle}>
            <Ionicons name="library-outline" size={18} color="#2563eb" />
            <Text style={styles.compactTopText}>Biblioteca</Text>
          </View>
          <Pressable
            onPress={() => setToolsExpanded((value) => !value)}
            style={styles.compactTopButton}
            accessibilityLabel={
              toolsExpanded
                ? "Ocultar URL y búsqueda"
                : "Mostrar URL y búsqueda"
            }
          >
            <Ionicons
              name={toolsExpanded ? "chevron-up" : "chevron-down"}
              size={21}
              color="#2563eb"
            />
          </Pressable>
        </View>

        {toolsExpanded ? (
          <View style={styles.toolsPanel}>
            <View style={styles.addRow}>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder={
                  isSourceCatalog
                    ? isBooksFolder ? "https://www.casadellibro.com" : "https://www.elmundo.es"
                    : isBooksFolder
                      ? "Pega la URL de un libro"
                      : isNewsFolder
                        ? "Pega la URL de una noticia"
                      : "https://ejemplo.com"
                }
                placeholderTextColor="#94a3b8"
                style={styles.urlInput}
                autoCorrect={false}
                autoCapitalize="none"
                onSubmitEditing={handleAddUrl}
              />
              <Pressable
                onPress={handleAddUrl}
                disabled={!urlInput.trim() || saving}
                style={[
                  styles.addButton,
                  (!urlInput.trim() || saving) && styles.buttonDisabled,
                ]}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={19} color="#64748b" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por URL, dominio o autor…"
                placeholderTextColor="#94a3b8"
                style={[
                  styles.searchInput,
                  Platform.OS === "web" && styles.webInputNoOutline,
                ]}
                autoCorrect={false}
              />
              {search ? (
                <Pressable
                  onPress={() => setSearch("")}
                  style={styles.iconButton}
                >
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.backupRow}>
              <Pressable
                onPress={handleExportBackup}
                disabled={backupBusy || !libraryBackup}
                style={[
                  styles.backupButton,
                  (backupBusy || !libraryBackup) && styles.buttonDisabled,
                ]}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={17}
                  color="#2563eb"
                />
                <Text style={styles.backupButtonText}>Exportar JSON</Text>
              </Pressable>
              <Pressable
                onPress={handleImportBackup}
                disabled={backupBusy}
                style={[
                  styles.backupButton,
                  backupBusy && styles.buttonDisabled,
                ]}
              >
                <Ionicons
                  name="download-outline"
                  size={17}
                  color="#2563eb"
                />
                <Text style={styles.backupButtonText}>Importar JSON</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.folderScroll}
          contentContainerStyle={styles.folderBar}
        >
          {filters.map((folder) => {
            const id = String(folder._id);
            const active = folderFilter === id;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  setFolderFilter(id);
                }}
                style={[styles.folderChip, active && styles.folderChipActive]}
              >
                <Ionicons
                  name={folder.icon || "folder-outline"}
                  size={15}
                  color={active ? "#fff" : folder.color || "#475569"}
                />
                <Text
                  style={[styles.folderText, active && styles.folderTextActive]}
                >
                  {folder.name}
                </Text>
              </Pressable>
            );
          })}
          {!isSourceCatalog ? (
            <Pressable
              onPress={() => {
                setEditingFolder(null);
                setCreatingFolder(true);
              }}
              style={styles.newFolderChip}
            >
              <Ionicons name="folder-open-outline" size={15} color="#2563eb" />
              <Text style={styles.newFolderText}>Nueva categoría</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {creatingFolder ? (
          <View style={styles.folderEditor}>
            <View style={styles.folderEditorHeader}>
              <Ionicons
                name="folder-open-outline"
                size={17}
                color={selectedFolder?.color || "#2563eb"}
              />
              <Text style={styles.folderEditorTitle}>Nueva categoría</Text>
            </View>
            <View style={styles.folderEditorRow}>
              <TextInput
                value={folderName}
                onChangeText={setFolderName}
                placeholder="Nombre de la categoría"
                placeholderTextColor="#94a3b8"
                style={styles.folderEditorInput}
                maxLength={50}
                autoFocus
                onSubmitEditing={handleCreateFolder}
              />
              <Pressable
                onPress={() => {
                  setCreatingFolder(false);
                  setFolderName("");
                }}
                style={styles.folderEditorCancel}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
              <Pressable
                onPress={handleCreateFolder}
                disabled={!folderName.trim() || saving}
                style={[
                  styles.folderEditorSave,
                  (!folderName.trim() || saving) && styles.buttonDisabled,
                ]}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.folderEditorSaveText}>Crear</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Las subcategorías se conservan en datos antiguos, pero ya no se muestran. */}
        {false && editingFolder ? (
          <View style={styles.folderEditor}>
            <View style={styles.folderEditorHeader}>
              <Ionicons name="create-outline" size={17} color="#2563eb" />
              <Text style={styles.folderEditorTitle}>Editar subcategoría</Text>
            </View>
            <View style={styles.folderEditorRow}>
              <TextInput
                value={editingFolderName}
                onChangeText={setEditingFolderName}
                placeholder="Nombre de la subcategoría"
                placeholderTextColor="#94a3b8"
                style={styles.folderEditorInput}
                maxLength={50}
                autoFocus
                onSubmitEditing={handleUpdateFolder}
              />
              <Pressable
                onPress={confirmRemoveFolder}
                disabled={saving}
                style={styles.folderEditorDelete}
              >
                <Ionicons name="trash-outline" size={19} color="#dc2626" />
              </Pressable>
              <Pressable
                onPress={() => setEditingFolder(null)}
                style={styles.folderEditorCancel}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
              <Pressable
                onPress={handleUpdateFolder}
                disabled={!editingFolderName.trim() || saving}
                style={[
                  styles.folderEditorSave,
                  (!editingFolderName.trim() || saving) &&
                    styles.buttonDisabled,
                ]}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.folderEditorSaveText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {false &&
        childFolders.length &&
        (!isNewsFolder || newsView === "articles") ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.subfolderScroll}
            contentContainerStyle={styles.subfolderBar}
          >
            {[
              { _id: "all", name: "Todos", icon: "apps-outline" },
              ...childFolders,
            ].map((folder) => {
              const id = String(folder._id);
              const active = subfolderFilter === id;
              return (
                <View
                  key={id}
                  style={[
                    styles.subfolderChip,
                    active && styles.subfolderChipActive,
                  ]}
                >
                  <Pressable
                    onPress={() => setSubfolderFilter(id)}
                    style={styles.subfolderMain}
                  >
                    <Ionicons
                      name={folder.icon || "folder-outline"}
                      size={14}
                      color={active ? "#fff" : folder.color || "#2563eb"}
                    />
                    <Text
                      style={[
                        styles.subfolderText,
                        active && styles.subfolderTextActive,
                      ]}
                    >
                      {folder.name}
                    </Text>
                  </Pressable>
                  {id !== "all" ? (
                    <Pressable
                      onPress={() => openFolderEditor(folder)}
                      style={styles.subfolderEdit}
                    >
                      <Ionicons
                        name="pencil"
                        size={12}
                        color={active ? "#fff" : "#2563eb"}
                      />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        {isCatalogFolder ? (
          <View style={styles.newsTabs}>
            <Pressable
              onPress={() => {
                setNewsView("sources");
                setCreatingFolder(false);
                setEditingFolder(null);
              }}
              style={[
                styles.newsTab,
                newsView === "sources" && styles.newsTabActive,
              ]}
            >
              <Ionicons
                name={isBooksFolder ? "storefront-outline" : "newspaper-outline"}
                size={16}
                color={newsView === "sources" ? "#fff" : "#475569"}
              />
              <Text
                style={[
                  styles.newsTabText,
                  newsView === "sources" && styles.newsTabTextActive,
                ]}
              >
                {isBooksFolder ? "Tiendas de libros" : "Periódicos"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setNewsView("articles")}
              style={[
                styles.newsTab,
                newsView === "articles" && styles.newsTabActive,
              ]}
            >
              <Ionicons
                name={isBooksFolder ? "book-outline" : "bookmark-outline"}
                size={16}
                color={newsView === "articles" ? "#fff" : "#475569"}
              />
              <Text
                style={[
                  styles.newsTabText,
                  newsView === "articles" && styles.newsTabTextActive,
                ]}
              >
                {isBooksFolder ? "Libros guardados" : "Noticias guardadas"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <FlatList
          key={
            isSourceCatalog ? "source-catalog" : `library-links-${cardColumns}`
          }
          data={links || []}
          horizontal={isSourceCatalog}
          numColumns={isSourceCatalog ? 1 : cardColumns}
          columnWrapperStyle={
            !isSourceCatalog && cardColumns > 1 ? styles.linkRow : undefined
          }
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => String(item._id)}
          style={[styles.list, isSourceCatalog && styles.sourceList]}
          contentContainerStyle={[
            isSourceCatalog ? styles.sourceListContent : styles.listContent,
            links?.length === 0 && styles.listEmpty,
          ]}
          renderItem={({ item }) => {
            if (isSourceCatalog) {
              return (
                <View style={styles.sourceTile}>
                  <Pressable
                    onPress={() => openSourceUrl(item.normalizedUrl)}
                    style={styles.sourceTileMain}
                  >
                    <View style={styles.sourceTileIcon}>
                      <Ionicons
                        name={isBooksFolder ? "storefront-outline" : "newspaper-outline"}
                        size={24}
                        color={isBooksFolder ? "#7c3aed" : "#dc2626"}
                      />
                    </View>
                    <Text style={styles.sourceTileTitle} numberOfLines={1}>
                      {item.customTitle || item.hostname}
                    </Text>
                    <Text style={styles.sourceTileDomain} numberOfLines={1}>
                      {item.sourceDomain || item.hostname}
                    </Text>
                    <Text style={styles.sourceTileUrl} numberOfLines={2}>
                      {item.normalizedUrl}
                    </Text>
                  </Pressable>
                  <View style={styles.sourceTileActions}>
                    <Pressable
                      onPress={() => openSourceUrl(item.normalizedUrl)}
                      style={styles.sourceTileButton}
                    >
                      <Ionicons name="open-outline" size={18} color="#2563eb" />
                    </Pressable>
                    <Pressable
                      onPress={() => openSourceEditor(item)}
                      style={styles.sourceTileButton}
                    >
                      <Ionicons name="pencil" size={17} color="#475569" />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmRemoveSource(item)}
                      style={styles.sourceTileButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#dc2626"
                      />
                    </Pressable>
                  </View>
                </View>
              );
            }
            const folder = item.folderId
              ? folderById.get(String(item.folderId))
              : null;
            return (
              <View style={styles.linkCard}>
                <WebPreviewCard url={item.normalizedUrl} compact dense />
                {["newsSource", "bookStore"].includes(item.linkType) && item.customTitle ? (
                  <Text style={styles.sourceCustomTitle}>
                    {item.customTitle}
                  </Text>
                ) : null}
                {!["newsSource", "bookStore"].includes(item.linkType) && item.notes ? (
                  <Text style={styles.linkNotes}>{item.notes}</Text>
                ) : null}
                {!["newsSource", "bookStore"].includes(item.linkType) && item.hashtags?.length ? (
                  <View style={styles.hashtagRow}>
                    {item.hashtags.map((tag) => (
                      <Pressable key={tag} onPress={() => setSearch(tag)}>
                        <Text style={styles.hashtag}>#{tag}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.actionsRow}>
                  <View style={styles.categoryBadge}>
                    <Ionicons
                      name={folder?.icon || "file-tray-outline"}
                      size={14}
                      color={folder?.color || "#64748b"}
                    />
                    <Text style={styles.categoryText} numberOfLines={1}>
                      {item.linkType === "newsSource"
                        ? `Periódico · ${item.sourceDomain || item.hostname}`
                        : item.linkType === "bookStore"
                          ? `Tienda de libros · ${item.sourceDomain || item.hostname}`
                          : item.linkType === "bookLink"
                            ? `Libro · ${item.sourceDomain || item.hostname}`
                        : item.linkType === "newsArticle"
                          ? `Noticia · ${item.sourceDomain || item.hostname}${""}`
                          : folder?.name === "Libros"
                            ? `Libro · ${item.sourceDomain || item.hostname}`
                            : folder?.name || "Sin clasificar"}
                    </Text>
                  </View>
                  <View style={styles.cardActionButtons}>
                    <Pressable
                      onPress={() =>
                        ["newsSource", "bookStore"].includes(item.linkType)
                          ? openSourceEditor(item)
                          : openMetadataEditor(item)
                      }
                      style={styles.iconButton}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color="#475569"
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => toggleFavorite({ linkId: item._id })}
                      style={styles.iconButton}
                    >
                      <Ionicons
                        name={item.favorite ? "star" : "star-outline"}
                        size={18}
                        color={item.favorite ? "#eab308" : "#64748b"}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setMovingLink(item)}
                      style={styles.iconButton}
                    >
                      <Ionicons
                        name="folder-open-outline"
                        size={18}
                        color="#2563eb"
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => removeLink({ linkId: item._id })}
                      style={styles.iconButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#dc2626"
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="library-outline" size={46} color="#94a3b8" />
              <Text style={styles.emptyTitle}>
                {links === undefined ? "Cargando…" : "No hay enlaces"}
              </Text>
              <Text style={styles.emptyText}>
                Añade una URL o selecciona otra categoría.
              </Text>
            </View>
          }
        />

        <Modal
          visible={exportNameVisible}
          transparent
          animationType="fade"
          onRequestClose={closeExportReview}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.importModalCard]}>
              <ScrollView
                style={styles.importModalScroll}
                contentContainerStyle={styles.importModalContent}
                showsVerticalScrollIndicator
              >
                <Text style={styles.modalTitle}>Exportar Biblioteca</Text>

                <Text style={styles.fieldLabel}>Nombre del archivo JSON</Text>
                <TextInput
                  value={exportFilename}
                  onChangeText={setExportFilename}
                  placeholder="shopp-biblioteca.json"
                  placeholderTextColor="#94a3b8"
                  style={styles.modalInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  maxLength={120}
                  autoFocus
                  selectTextOnFocus
                  onSubmitEditing={performExportBackup}
                />
                <Text style={styles.fieldHelp}>
                  Si omites la extensión, se añadirá automáticamente .json.
                </Text>

                <Text style={styles.fieldLabel}>Informe del contenido</Text>
                <View style={styles.importSummaryBox}>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="folder-outline" size={17} color="#2563eb" />
                    <Text style={styles.importSummaryText}>
                      {exportReview?.folderCount || 0} carpetas
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="link-outline" size={17} color="#2563eb" />
                    <Text style={styles.importSummaryText}>
                      {exportReview?.linkCount || 0} enlaces en total
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="newspaper-outline" size={17} color="#dc2626" />
                    <Text style={styles.importSummaryText}>
                      {exportReview?.sourceCount || 0} periódicos o tiendas de libros
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="bookmark-outline" size={17} color="#7c3aed" />
                    <Text style={styles.importSummaryText}>
                      {exportReview?.savedLinkCount || 0} enlaces guardados
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Categorías a exportar</Text>
                <Text style={styles.fieldHelp}>
                  Elige todas las categorías o solo las que quieras incluir. Las subcategorías se exportan con su categoría principal.
                </Text>

                <View style={styles.importCategoryList}>
                  <ImportCheckbox
                    checked={allExportCategoriesSelected}
                    label="Todas las categorías"
                    detail={`${exportReview?.linkCount || 0} enlaces`}
                    icon="apps-outline"
                    color="#2563eb"
                    onPress={() =>
                      setSelectedExportCategoryKeys(
                        allExportCategoriesSelected
                          ? []
                          : exportCategories.map((category) => category.key),
                      )
                    }
                    disabled={exportCategories.length === 0}
                  />
                  {exportCategories.map((category) => (
                    <ImportCheckbox
                      key={category.key}
                      checked={selectedExportCategoryKeys.includes(category.key)}
                      label={category.name}
                      detail={`${category.linkCount} ${category.linkCount === 1 ? "enlace" : "enlaces"}`}
                      icon={category.icon}
                      color={category.color}
                      onPress={() => toggleExportCategory(category.key)}
                    />
                  ))}
                </View>

                <Text style={styles.importSelectionHelp}>
                  Se exportarán {selectedExportLinkCount} enlaces. La copia mantendrá el formato compatible de Biblioteca.
                </Text>
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeExportReview}
                  disabled={backupBusy}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={performExportBackup}
                  disabled={
                    backupBusy ||
                    !normalizeBackupFilename(exportFilename) ||
                    (exportCategories.length > 0 &&
                      selectedExportCategoryKeys.length === 0)
                  }
                  style={[
                    styles.saveButton,
                    styles.exportConfirmButton,
                    (backupBusy ||
                      !normalizeBackupFilename(exportFilename) ||
                      (exportCategories.length > 0 &&
                        selectedExportCategoryKeys.length === 0)) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Ionicons name="cloud-upload-outline" size={17} color="#fff" />
                  <Text style={styles.saveText}>
                    {backupBusy ? "Exportando…" : "Exportar seleccionados"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(importReview)}
          transparent
          animationType="fade"
          onRequestClose={closeImportReview}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.importModalCard]}>
              <ScrollView
                style={styles.importModalScroll}
                contentContainerStyle={styles.importModalContent}
                showsVerticalScrollIndicator
              >
                <Text style={styles.modalTitle}>Importar Biblioteca</Text>

                <Text style={styles.fieldLabel}>Fichero seleccionado</Text>
                <View style={styles.importFileBox}>
                  <Ionicons name="document-text-outline" size={20} color="#2563eb" />
                  <Text style={styles.importFileName} numberOfLines={2}>
                    {importReview?.fileName}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Informe del contenido</Text>
                <View style={styles.importSummaryBox}>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="folder-outline" size={17} color="#2563eb" />
                    <Text style={styles.importSummaryText}>
                      {importReview?.folderCount || 0} carpetas
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="link-outline" size={17} color="#2563eb" />
                    <Text style={styles.importSummaryText}>
                      {importReview?.linkCount || 0} enlaces en total
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="newspaper-outline" size={17} color="#dc2626" />
                    <Text style={styles.importSummaryText}>
                      {importReview?.sourceCount || 0} periódicos o tiendas de libros
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="bookmark-outline" size={17} color="#7c3aed" />
                    <Text style={styles.importSummaryText}>
                      {importReview?.savedLinkCount || 0} enlaces guardados
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Categorías a importar</Text>
                <Text style={styles.fieldHelp}>
                  Elige todas las categorías o solo las que quieras añadir. Las subcategorías se incluyen con su categoría principal.
                </Text>

                <View style={styles.importCategoryList}>
                  <ImportCheckbox
                    checked={allImportCategoriesSelected}
                    label="Todas las categorías"
                    detail={`${importReview?.linkCount || 0} enlaces`}
                    icon="apps-outline"
                    color="#2563eb"
                    onPress={() =>
                      setSelectedImportCategoryKeys(
                        allImportCategoriesSelected
                          ? []
                          : importCategories.map((category) => category.key),
                      )
                    }
                    disabled={importCategories.length === 0}
                  />
                  {importCategories.map((category) => (
                    <ImportCheckbox
                      key={category.key}
                      checked={selectedImportCategoryKeys.includes(category.key)}
                      label={category.name}
                      detail={`${category.linkCount} ${category.linkCount === 1 ? "enlace" : "enlaces"}`}
                      icon={category.icon}
                      color={category.color}
                      onPress={() => toggleImportCategory(category.key)}
                    />
                  ))}
                </View>

                <Text style={styles.importSelectionHelp}>
                  {importMode === "replace"
                    ? "Se eliminarán los datos actuales y se conservarán únicamente los elementos seleccionados."
                    : "Se combinarán los elementos seleccionados. Los datos actuales se conservarán y las URL repetidas se actualizarán."}
                </Text>

                <Text style={styles.fieldLabel}>Modo de importación</Text>
                <View style={styles.importModeList}>
                  <Pressable
                    onPress={() => setImportMode("combine")}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: importMode === "combine" }}
                    style={[
                      styles.importModeOption,
                      importMode === "combine" && styles.importModeSelected,
                    ]}
                  >
                    <Ionicons
                      name={
                        importMode === "combine"
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={importMode === "combine" ? "#2563eb" : "#94a3b8"}
                    />
                    <View style={styles.importOptionText}>
                      <Text style={styles.importOptionLabel}>Combinar</Text>
                      <Text style={styles.importOptionDetail}>
                        Conserva YouTube, El País y el resto de datos actuales.
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => setImportMode("replace")}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: importMode === "replace" }}
                    style={[
                      styles.importModeOption,
                      importMode === "replace" && styles.importModeReplaceSelected,
                    ]}
                  >
                    <Ionicons
                      name={
                        importMode === "replace"
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={importMode === "replace" ? "#dc2626" : "#94a3b8"}
                    />
                    <View style={styles.importOptionText}>
                      <Text style={styles.importOptionLabel}>
                        Reemplazar Biblioteca
                      </Text>
                      <Text style={styles.importOptionDetail}>
                        Elimina lo actual y deja solo lo seleccionado.
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeImportReview}
                  disabled={backupBusy}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleImportSelected}
                  disabled={
                    backupBusy ||
                    (importCategories.length > 0 &&
                      selectedImportCategoryKeys.length === 0)
                  }
                  style={[
                    styles.saveButton,
                    styles.exportConfirmButton,
                    (backupBusy ||
                      (importCategories.length > 0 &&
                        selectedImportCategoryKeys.length === 0)) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Ionicons
                    name={importMode === "replace" ? "trash-outline" : "download-outline"}
                    size={17}
                    color="#fff"
                  />
                  <Text style={styles.saveText}>
                    {backupBusy
                      ? "Importando…"
                      : importMode === "replace"
                        ? "Reemplazar Biblioteca"
                        : "Importar seleccionados"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(editingSource)}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingSource(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editingSource?.linkType === "bookStore" ? "Editar tienda de libros" : "Editar periódico"}</Text>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                value={sourceNameInput}
                onChangeText={setSourceNameInput}
                placeholder={editingSource?.linkType === "bookStore" ? "Por ejemplo: Casa del Libro" : "Por ejemplo: El País"}
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                maxLength={80}
              />
              <Text style={styles.fieldLabel}>Dirección de portada</Text>
              <TextInput
                value={sourceUrlInput}
                onChangeText={setSourceUrlInput}
                placeholder={editingSource?.linkType === "bookStore" ? "https://www.casadellibro.com" : "https://elpais.com"}
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                autoCorrect={false}
                autoCapitalize="none"
                onSubmitEditing={handleSaveSource}
              />
              <Text style={styles.fieldHelp}>
                Los comentarios y hashtags se añaden a los {editingSource?.linkType === "bookStore" ? "libros" : "noticias"} guardados, no a la fuente.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setEditingSource(null)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveSource}
                  disabled={!sourceUrlInput.trim() || saving}
                  style={[
                    styles.saveButton,
                    (!sourceUrlInput.trim() || saving) && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.saveText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(editingLink)}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingLink(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Comentario y hashtags</Text>
              <Text style={styles.fieldLabel}>Comentario</Text>
              <TextInput
                value={notesInput}
                onChangeText={setNotesInput}
                placeholder="Añade una nota sobre este enlace…"
                placeholderTextColor="#94a3b8"
                style={[styles.modalInput, styles.notesInput]}
                multiline
                maxLength={1000}
              />
              <Text style={styles.fieldLabel}>Hashtags</Text>
              <TextInput
                value={hashtagsInput}
                onChangeText={setHashtagsInput}
                placeholder="#javascript #tutorial #consulta"
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Text style={styles.fieldHelp}>
                Sepáralos mediante espacios o comas.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setEditingLink(null)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveMetadata}
                  disabled={saving}
                  style={[styles.saveButton, saving && styles.buttonDisabled]}
                >
                  <Text style={styles.saveText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(movingLink)}
          transparent
          animationType="fade"
          onRequestClose={() => setMovingLink(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Mover a categoría</Text>
              <ScrollView style={styles.moveList}>
                <Pressable
                  onPress={() => handleMove(null)}
                  style={styles.moveItem}
                >
                  <Ionicons
                    name="file-tray-outline"
                    size={20}
                    color="#64748b"
                  />
                  <Text style={styles.moveText}>Sin clasificar</Text>
                </Pressable>
                {topFolders.map((folder) => (
                  <Pressable
                    key={String(folder._id)}
                    onPress={() => handleMove(folder)}
                    style={styles.moveItem}
                  >
                    <Ionicons
                      name={folder.icon || "folder-outline"}
                      size={20}
                      color={folder.color || "#475569"}
                    />
                    <Text style={styles.moveText}>{folder.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                onPress={() => setMovingLink(null)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  compactTopBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  compactTopButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTopTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  compactTopText: { fontSize: 14, fontWeight: "900", color: "#1e293b" },
  toolsPanel: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  iconBox: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
  },
  introText: { flex: 1 },
  title: { fontSize: 21, fontWeight: "900", color: "#111827" },
  subtitle: { marginTop: 2, fontSize: 12, color: "#64748b" },
  addRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  urlInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#111827",
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  buttonDisabled: { opacity: 0.45 },
  searchRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  searchInput: { flex: 1, minHeight: 42, fontSize: 14, color: "#111827" },
  webInputNoOutline: { outlineStyle: "none", outlineWidth: 0 },
  backupRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  backupButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  backupButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  folderScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
    maxHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  folderBar: {
    height: 44,
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  folderChip: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  folderChipActive: { borderColor: "#2563eb", backgroundColor: "#2563eb" },
  folderText: { fontSize: 10, fontWeight: "800", color: "#475569" },
  folderTextActive: { color: "#fff" },
  newFolderChip: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  newFolderText: { fontSize: 10, fontWeight: "800", color: "#2563eb" },
  folderEditor: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#eff6ff",
  },
  folderEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
  },
  folderEditorTitle: { fontSize: 12, fontWeight: "900", color: "#334155" },
  folderEditorRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  folderEditorInput: {
    flex: 1,
    minHeight: 39,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#fff",
    fontSize: 13,
    color: "#111827",
  },
  folderEditorCancel: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  folderEditorDelete: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff",
  },
  folderEditorSave: {
    height: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
    backgroundColor: "#2563eb",
  },
  folderEditorSaveText: { fontSize: 11, fontWeight: "900", color: "#fff" },
  subfolderScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 42,
    maxHeight: 42,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  subfolderBar: {
    height: 42,
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  subfolderChip: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  subfolderChipActive: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  subfolderMain: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 9,
    paddingRight: 7,
  },
  subfolderEdit: {
    width: 25,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 4,
  },
  subfolderText: { fontSize: 10, fontWeight: "800", color: "#1d4ed8" },
  subfolderTextActive: { color: "#fff" },
  newsTabs: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
  },
  newsTab: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  newsTabActive: { borderColor: "#dc2626", backgroundColor: "#dc2626" },
  newsTabText: { fontSize: 11, fontWeight: "800", color: "#475569" },
  newsTabTextActive: { color: "#fff" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 16 },
  linkRow: { gap: 8 },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  sourceList: { flex: 1, backgroundColor: "#f1f5f9" },
  sourceListContent: {
    alignItems: "flex-start",
    gap: 9,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sourceTile: {
    width: 190,
    minHeight: 156,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  sourceTileMain: { flex: 1, padding: 12 },
  sourceTileIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
  },
  sourceTileTitle: { fontSize: 14, fontWeight: "900", color: "#1e293b" },
  sourceTileDomain: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "800",
    color: "#dc2626",
  },
  sourceTileUrl: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 14,
    color: "#64748b",
  },
  sourceTileActions: {
    height: 38,
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  sourceTileButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  linkCard: {
    flex: 1,
    alignSelf: "flex-start",
    minWidth: 0,
    maxWidth: 262,
    marginBottom: 8,
    padding: 5,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#fff",
  },
  linkNotes: {
    marginTop: 7,
    paddingHorizontal: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#475569",
  },
  sourceCustomTitle: {
    marginTop: 7,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: "900",
    color: "#1e293b",
  },
  hashtagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingHorizontal: 8,
    paddingTop: 7,
  },
  hashtag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    fontSize: 10,
    fontWeight: "800",
    color: "#2563eb",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    paddingTop: 4,
  },
  categoryBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "#f1f5f9",
  },
  categoryText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  cardActionButtons: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 25,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingHorizontal: 30 },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "900",
    color: "#334155",
  },
  emptyText: {
    marginTop: 5,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  modalCard: {
    width: 380,
    maxWidth: "100%",
    maxHeight: "78%",
    padding: 16,
    backgroundColor: "#fff",
  },
  importModalCard: {
    maxHeight: "88%",
    padding: 0,
  },
  importModalScroll: { flexShrink: 1 },
  importModalContent: { padding: 16, paddingBottom: 6 },
  modalTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  modalInput: {
    minHeight: 44,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#111827",
  },
  notesInput: { minHeight: 92, paddingTop: 11, textAlignVertical: "top" },
  fieldLabel: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
  },
  fieldHelp: { marginTop: 5, fontSize: 10, color: "#64748b" },
  importFileBox: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  importFileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  importSummaryBox: {
    gap: 7,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  importSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  importSummaryText: { flex: 1, fontSize: 12, color: "#334155" },
  importCategoryList: { marginTop: 10, gap: 6 },
  importOption: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  importOptionChecked: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },
  importOptionPressed: { opacity: 0.75 },
  importCheckbox: {
    width: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#94a3b8",
    backgroundColor: "#fff",
  },
  importCheckboxChecked: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  importOptionText: { flex: 1, minWidth: 0 },
  importOptionLabel: { fontSize: 13, fontWeight: "800", color: "#334155" },
  importOptionDetail: { marginTop: 2, fontSize: 10, color: "#64748b" },
  importSelectionHelp: {
    marginTop: 10,
    fontSize: 10,
    lineHeight: 15,
    color: "#64748b",
  },
  importModeList: { gap: 6, marginTop: 8 },
  importModeOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  importModeSelected: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },
  importModeReplaceSelected: {
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  cancelButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  cancelText: { fontSize: 13, fontWeight: "800", color: "#475569" },
  saveButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#2563eb",
  },
  exportConfirmButton: { flexDirection: "row", gap: 7 },
  saveText: { fontSize: 13, fontWeight: "900", color: "#fff" },
  moveList: { flexGrow: 0, marginBottom: 12 },
  moveItem: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  moveText: { fontSize: 14, fontWeight: "700", color: "#334155" },
});
