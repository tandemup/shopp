import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  I18nText as Text,
  I18nTextInput as TextInput,
} from "@/src/i18n";
import WebPreviewCard from "@/src/components/chat/WebPreviewCard";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const CLIENT_ID_KEY = "shopp-chat-client-id";

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

export default function LibraryScreen() {
  const [clientId] = useState(getClientId);
  const [urlInput, setUrlInput] = useState("");
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [subfolderFilter, setSubfolderFilter] = useState("all");
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

  const folders = useQuery(api.computerLinks.listFolders) || [];
  const selectedFolderId =
    !["all", "favorites", "unclassified"].includes(folderFilter)
      ? folderFilter
      : undefined;
  const selectedFolder = folders.find(
    (folder) => String(folder._id) === String(selectedFolderId),
  );
  const childFolders = selectedFolderId
    ? folders.filter(
        (folder) =>
          String(folder.parentFolderId || "") === String(selectedFolderId),
      )
    : [];
  const selectedSubfolderId =
    subfolderFilter !== "all" &&
    childFolders.some(
      (folder) => String(folder._id) === String(subfolderFilter),
    )
      ? subfolderFilter
      : undefined;
  const isNewsFolder = selectedFolder?.name === "Noticias";
  const isSourceCatalog = isNewsFolder && newsView === "sources";
  const activeSubfolderId =
    isNewsFolder && newsView === "sources" ? undefined : selectedSubfolderId;
  const links = useQuery(api.computerLinks.list, {
    search: search.trim() || undefined,
    folderId: activeSubfolderId || selectedFolderId,
    includeChildFolders:
      Boolean(
        selectedFolderId &&
          !activeSubfolderId &&
          childFolders.length &&
          (!isNewsFolder || newsView === "articles"),
      ) ||
      undefined,
    onlyFavorites: folderFilter === "favorites" || undefined,
    onlyUnclassified: folderFilter === "unclassified" || undefined,
    linkType: isNewsFolder
      ? newsView === "sources"
        ? "newsSource"
        : "newsArticle"
      : undefined,
  });

  const ensureDefaultFolders = useMutation(
    api.computerLinks.ensureDefaultFolders,
  );
  const syncFromChat = useMutation(api.computerLinks.syncFromChat);
  const addUrl = useMutation(api.computerLinks.addUrl);
  const createFolder = useMutation(api.computerLinks.createFolder);
  const updateFolder = useMutation(api.computerLinks.updateFolder);
  const removeFolder = useMutation(api.computerLinks.removeFolder);
  const toggleFavorite = useMutation(api.computerLinks.toggleFavorite);
  const updateMetadata = useMutation(api.computerLinks.updateMetadata);
  const updateNewsSource = useMutation(api.computerLinks.updateNewsSource);
  const moveToFolder = useMutation(api.computerLinks.moveToFolder);
  const removeLink = useMutation(api.computerLinks.remove);

  useEffect(() => {
    ensureDefaultFolders({ clientId })
      .then(() => syncFromChat({ clientId }))
      .catch((error) => console.warn("[LibraryScreen] sync failed", error));
  }, [clientId, ensureDefaultFolders, syncFromChat]);

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
        folderId:
          isNewsFolder && newsView === "sources"
            ? selectedFolderId
            : selectedSubfolderId || selectedFolderId,
        linkType: isNewsFolder
          ? newsView === "sources"
            ? "newsSource"
            : "newsArticle"
          : "general",
      });
      setUrlInput("");
      if (result.existing) {
        safeAlert("Enlace recuperado", "El enlace ya existía en la biblioteca.");
      }
    } catch (error) {
      safeAlert("URL no válida", error?.message || "No se pudo guardar el enlace.");
    } finally {
      setSaving(false);
    }
  }, [
    addUrl,
    clientId,
    isNewsFolder,
    newsView,
    saving,
    selectedFolderId,
    selectedSubfolderId,
    urlInput,
  ]);

  const handleCreateFolder = useCallback(async () => {
    if (!folderName.trim() || saving) return;
    setSaving(true);
    try {
      const result = await createFolder({
        name: folderName.trim(),
        clientId,
        parentFolderId:
          selectedFolderId && (!isNewsFolder || newsView === "articles")
            ? selectedFolderId
            : undefined,
      });
      setFolderName("");
      setCreatingFolder(false);
      if (selectedFolderId && (!isNewsFolder || newsView === "articles")) {
        setSubfolderFilter(String(result.folderId));
      } else {
        setFolderFilter(String(result.folderId));
        setSubfolderFilter("all");
      }
    } catch (error) {
      safeAlert("No se pudo crear", error?.message || "Revisa el nombre.");
    } finally {
      setSaving(false);
    }
  }, [
    clientId,
    createFolder,
    folderName,
    isNewsFolder,
    newsView,
    saving,
    selectedFolderId,
  ]);

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

  const openFolderEditor = useCallback((folder) => {
    setCreatingFolder(false);
    setEditingFolder(folder);
    setEditingFolderName(folder?.name || "");
  }, []);

  const handleUpdateFolder = useCallback(async () => {
    if (!editingFolder?._id || !editingFolderName.trim() || saving) return;
    setSaving(true);
    try {
      await updateFolder({
        folderId: editingFolder._id,
        name: editingFolderName.trim(),
      });
      setEditingFolder(null);
      setEditingFolderName("");
    } catch (error) {
      safeAlert("No se pudo editar", error?.message || "Revisa el nombre.");
    } finally {
      setSaving(false);
    }
  }, [editingFolder, editingFolderName, saving, updateFolder]);

  const confirmRemoveFolder = useCallback(() => {
    if (!editingFolder?._id || saving) return;
    safeAlert(
      "Eliminar subcategoría",
      `Los enlaces de “${editingFolder.name}” se moverán a ${selectedFolder?.name || "la categoría principal"}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await removeFolder({ folderId: editingFolder._id });
              setSubfolderFilter("all");
              setEditingFolder(null);
              setEditingFolderName("");
            } catch (error) {
              safeAlert("No se pudo eliminar", error?.message || "Inténtalo de nuevo.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [editingFolder, removeFolder, saving, selectedFolder?.name]);

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
  }, [editingSource, saving, sourceNameInput, sourceUrlInput, updateNewsSource]);

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
        "Eliminar periódico",
        `Se eliminará ${source.customTitle || source.hostname} del catálogo. Las noticias guardadas no se borrarán.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                await removeLink({ linkId: source._id });
              } catch (error) {
                safeAlert("No se pudo eliminar", error?.message || "Inténtalo de nuevo.");
              }
            },
          },
        ],
      );
    },
    [removeLink],
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
        <View style={styles.intro}>
          <View style={styles.iconBox}>
            <Ionicons name="library-outline" size={25} color="#2563eb" />
          </View>
          <View style={styles.introText}>
            <Text style={styles.title}>Biblioteca</Text>
            <Text style={styles.subtitle}>
              Organiza tus páginas web por categorías
            </Text>
          </View>
        </View>

        <View style={styles.addRow}>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder={
              isNewsFolder && newsView === "sources"
                ? "https://www.elmundo.es"
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
            style={styles.searchInput}
            autoCorrect={false}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} style={styles.iconButton}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

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
                  setSubfolderFilter("all");
                }}
                style={[styles.folderChip, active && styles.folderChipActive]}
              >
                <Ionicons
                  name={folder.icon || "folder-outline"}
                  size={15}
                  color={active ? "#fff" : folder.color || "#475569"}
                />
                <Text style={[styles.folderText, active && styles.folderTextActive]}>
                  {folder.name}
                </Text>
              </Pressable>
            );
          })}
          {!(isNewsFolder && newsView === "sources") ? (
            <Pressable
              onPress={() => {
                setEditingFolder(null);
                setCreatingFolder(true);
              }}
              style={styles.newFolderChip}
            >
              <Ionicons name="folder-open-outline" size={15} color="#2563eb" />
              <Text style={styles.newFolderText}>
                {selectedFolderId ? "Nueva subcategoría" : "Nueva categoría"}
              </Text>
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
              <Text style={styles.folderEditorTitle}>
                {selectedFolderId && (!isNewsFolder || newsView === "articles")
                  ? `Nueva subcategoría de ${selectedFolder?.name || "categoría"}`
                  : "Nueva categoría"}
              </Text>
            </View>
            <View style={styles.folderEditorRow}>
              <TextInput
                value={folderName}
                onChangeText={setFolderName}
                placeholder="Nombre de la subcategoría"
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

        {editingFolder ? (
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
                  (!editingFolderName.trim() || saving) && styles.buttonDisabled,
                ]}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.folderEditorSaveText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {childFolders.length && (!isNewsFolder || newsView === "articles") ? (
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

        {isNewsFolder ? (
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
                name="newspaper-outline"
                size={16}
                color={newsView === "sources" ? "#fff" : "#475569"}
              />
              <Text
                style={[
                  styles.newsTabText,
                  newsView === "sources" && styles.newsTabTextActive,
                ]}
              >
                Periódicos
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
                name="bookmark-outline"
                size={16}
                color={newsView === "articles" ? "#fff" : "#475569"}
              />
              <Text
                style={[
                  styles.newsTabText,
                  newsView === "articles" && styles.newsTabTextActive,
                ]}
              >
                Noticias guardadas
              </Text>
            </Pressable>
          </View>
        ) : null}

        <FlatList
          key={isSourceCatalog ? "source-catalog" : "library-links"}
          data={links || []}
          horizontal={isSourceCatalog}
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
                      <Ionicons name="newspaper-outline" size={24} color="#dc2626" />
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
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
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
                <WebPreviewCard url={item.normalizedUrl} compact />
                {item.linkType === "newsSource" && item.customTitle ? (
                  <Text style={styles.sourceCustomTitle}>{item.customTitle}</Text>
                ) : null}
                {item.linkType !== "newsSource" && item.notes ? (
                  <Text style={styles.linkNotes}>{item.notes}</Text>
                ) : null}
                {item.linkType !== "newsSource" && item.hashtags?.length ? (
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
                        : item.linkType === "newsArticle"
                          ? `Noticia · ${item.sourceDomain || item.hostname}${
                              folder?.parentFolderId ? ` · ${folder.name}` : ""
                            }`
                          : folder?.name || "Sin clasificar"}
                    </Text>
                  </View>
                  {item.linkType === "newsSource" ? (
                    <Pressable
                      onPress={() => openSourceEditor(item)}
                      style={styles.iconButton}
                    >
                      <Ionicons name="create-outline" size={20} color="#475569" />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => openMetadataEditor(item)}
                      style={styles.iconButton}
                    >
                      <Ionicons name="create-outline" size={20} color="#475569" />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => toggleFavorite({ linkId: item._id })}
                    style={styles.iconButton}
                  >
                    <Ionicons
                      name={item.favorite ? "star" : "star-outline"}
                      size={20}
                      color={item.favorite ? "#eab308" : "#64748b"}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => setMovingLink(item)}
                    style={styles.iconButton}
                  >
                    <Ionicons name="folder-open-outline" size={20} color="#2563eb" />
                  </Pressable>
                  <Pressable
                    onPress={() => removeLink({ linkId: item._id })}
                    style={styles.iconButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#dc2626" />
                  </Pressable>
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
          visible={Boolean(editingSource)}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingSource(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Editar periódico</Text>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                value={sourceNameInput}
                onChangeText={setSourceNameInput}
                placeholder="Por ejemplo: El País"
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                maxLength={80}
              />
              <Text style={styles.fieldLabel}>Dirección de portada</Text>
              <TextInput
                value={sourceUrlInput}
                onChangeText={setSourceUrlInput}
                placeholder="https://elpais.com"
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                autoCorrect={false}
                autoCapitalize="none"
                onSubmitEditing={handleSaveSource}
              />
              <Text style={styles.fieldHelp}>
                Los comentarios y hashtags se añaden a las noticias, no al periódico.
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
                <Pressable onPress={() => handleMove(null)} style={styles.moveItem}>
                  <Ionicons name="file-tray-outline" size={20} color="#64748b" />
                  <Text style={styles.moveText}>Sin clasificar</Text>
                </Pressable>
                {folders.map((folder) => (
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
              <Pressable onPress={() => setMovingLink(null)} style={styles.cancelButton}>
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
  intro: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: "#fff",
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
  listContent: { paddingHorizontal: 12, paddingBottom: 16 },
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
  sourceTileUrl: { marginTop: 6, fontSize: 10, lineHeight: 14, color: "#64748b" },
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
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginBottom: 12,
    padding: 8,
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
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 7 },
  categoryBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#f1f5f9",
  },
  categoryText: { fontSize: 11, fontWeight: "800", color: "#475569" },
  iconButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingHorizontal: 30 },
  emptyTitle: { marginTop: 10, fontSize: 17, fontWeight: "900", color: "#334155" },
  emptyText: { marginTop: 5, fontSize: 13, color: "#64748b", textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  modalCard: { width: 380, maxWidth: "100%", maxHeight: "78%", padding: 16, backgroundColor: "#fff" },
  modalTitle: { marginBottom: 12, fontSize: 18, fontWeight: "900", color: "#111827" },
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
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 14 },
  cancelButton: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#cbd5e1" },
  cancelText: { fontSize: 13, fontWeight: "800", color: "#475569" },
  saveButton: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, backgroundColor: "#2563eb" },
  saveText: { fontSize: 13, fontWeight: "900", color: "#fff" },
  moveList: { flexGrow: 0, marginBottom: 12 },
  moveItem: { minHeight: 47, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  moveText: { fontSize: 14, fontWeight: "700", color: "#334155" },
});
