import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import DatePill from "../../components/controls/DatePill";
import CurrencyBadge from "../../components/ui/CurrencyBadge";
import { safeAlert, safeMenu } from "../../components/ui/alert/safeAlert";
import { DEFAULT_CURRENCY } from "../../constants/currency";
import { useLists } from "../../context/ListsContext";
import { ROUTES } from "../../navigation/ROUTES";
import { buildHeaderConfig } from "../../utils/layout/headerStyles";

const headerConfig = buildHeaderConfig({
  title: "Shopping Lists",
  preset: "light",
});

function MenuNavegacion2({
  archivedCount = 0,
  historyCount = 0,
  scannedCount = 0,
  onCreateList,
}) {
  const navigation = useNavigation();

  const actions = [
    {
      key: "new",
      label: "Nueva lista",
      icon: "add-outline",
      onPress: onCreateList,
    },
    {
      key: "archived",
      label: "Archivadas",
      icon: "archive-outline",
      tab: ROUTES.SHOPPING_TAB,
      route: ROUTES.ARCHIVED_LISTS,
      badge: archivedCount,
    },
    {
      key: "history",
      label: "Compras",
      icon: "receipt-outline",
      tab: ROUTES.SHOPPING_TAB,
      route: ROUTES.PURCHASE_HISTORY,
      badge: historyCount,
    },
    {
      key: "scanned",
      label: "Escaneos",
      icon: "barcode-outline",
      tab: ROUTES.SCANNER_TAB,
      route: ROUTES.SCANNED_HISTORY,
      badge: scannedCount,
    },
  ];

  return (
    <View style={quickStyles.wrapper}>
      <Text style={quickStyles.title}>Accesos rápidos</Text>

      <ScrollView
        horizontal
        style={quickStyles.scrollContainer}
        contentContainerStyle={quickStyles.scrollContent}
        showsHorizontalScrollIndicator={false}
      >
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => {
              if (action.onPress) {
                action.onPress();
                return;
              }

              navigation.navigate(action.tab, {
                screen: action.route,
              });
            }}
            style={({ pressed }) => [
              quickStyles.card,
              pressed && quickStyles.cardPressed,
            ]}
          >
            <View style={quickStyles.iconBox}>
              <Ionicons name={action.icon} size={22} color="#2563eb" />

              {action.badge > 0 && (
                <View style={quickStyles.badge}>
                  <Text style={quickStyles.badgeText}>
                    {action.badge > 99 ? "99+" : action.badge}
                  </Text>
                </View>
              )}
            </View>

            <Text style={quickStyles.label}>{action.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ShoppingListsScreen() {
  const navigation = useNavigation();
  const listRef = useRef(null);

  const {
    activeLists = [],
    archivedLists = [],
    createList,
    deleteList,
    updateList,
    archiveList,
  } = useLists();

  const [editingList, setEditingList] = useState(undefined);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    navigation.setOptions(headerConfig.navigationOptions);
  }, [navigation]);

  const buildTodayListName = () => {
    const today = new Date();
    const baseName = today.toISOString().slice(0, 10);

    const allNames = [...activeLists, ...archivedLists].map((list) =>
      String(list.name || "").trim(),
    );

    if (!allNames.includes(baseName)) return baseName;

    let suffix = 2;
    while (allNames.includes(`${baseName}-${suffix}`)) suffix += 1;

    return `${baseName}-${suffix}`;
  };

  const handleAddList = () => {
    setEditingList(null);
    setEditName(buildTodayListName());
  };

  const handleOpenList = (listId) => {
    navigation.navigate(ROUTES.SHOPPING_LIST, { listId });
  };

  const openEditName = (list) => {
    setEditingList(list);
    setEditName(list?.name || "");
  };

  const closeEditModal = () => {
    setEditingList(undefined);
    setEditName("");
  };

  const handleConfirmEditName = () => {
    const name = editName.trim();
    if (!name) return;

    if (editingList) {
      updateList(editingList.id, { name });
    } else {
      createList(name, DEFAULT_CURRENCY);
    }

    closeEditModal();
  };

  const openListMenu = (list) => {
    safeMenu("Opciones de la lista", list?.name || "", [
      {
        text: "Editar nombre",
        onPress: () => {
          requestAnimationFrame(() => {
            openEditName(list);
          });
        },
      },
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
        onPress: () => {
          safeAlert(
            "Eliminar lista",
            `¿Seguro que quieres eliminar "${list.name}"?`,
            [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Eliminar",
                style: "destructive",
                onPress: () => deleteList(list.id),
              },
            ],
          );
        },
      },
      {
        text: "Cancelar",
        style: "cancel",
        onPress: () => {},
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const currency = item.currency ?? DEFAULT_CURRENCY;

    return (
      <Pressable style={styles.card} onPress={() => handleOpenList(item.id)}>
        <View style={styles.cardHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <CurrencyBadge currency={currency} size="sm" />
          </View>

          <Pressable
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation?.();
              openListMenu(item);
            }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#555" />
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Creada en</Text>

          <DatePill
            date={item.createdAt}
            fallback="Sin fecha"
            icon="calendar-outline"
          />
        </View>

        <Text style={styles.count}>{item.items?.length || 0} productos</Text>
      </Pressable>
    );
  };

  const sortedActiveLists = [...activeLists].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  return (
    <View style={styles.screen}>
      <StatusBar {...headerConfig.statusBar} />

      <SafeAreaView edges={["left", "right"]} style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Shopping Lists</Text>

          <Text style={styles.subtitle}>
            Crea, consulta y gestiona tus listas de compra activas.
          </Text>

          <MenuNavegacion2
            archivedCount={archivedLists.length}
            historyCount={0}
            scannedCount={0}
            onCreateList={handleAddList}
          />

          <FlatList
            ref={listRef}
            style={styles.list}
            data={sortedActiveLists}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={
              <Text style={styles.listHeader}>Mis Listas</Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyText}>
                  No tienes listas activas 😊
                </Text>

                <Text style={styles.emptyHint}>
                  Pulsa + para crear tu primera lista
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <Modal
          transparent
          visible={editingList !== undefined}
          animationType="fade"
        >
          <Pressable style={styles.modalOverlay} onPress={closeEditModal}>
            <Pressable
              style={styles.modalCard}
              onPress={(event) => event.stopPropagation()}
            >
              <Text style={styles.modalTitle}>
                {editingList ? "Editar nombre" : "Nueva lista"}
              </Text>

              <TextInput
                autoFocus
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                onSubmitEditing={handleConfirmEditName}
              />

              <View style={styles.modalActions}>
                <Pressable onPress={closeEditModal} style={styles.modalCancel}>
                  <Text>Cancelar</Text>
                </Pressable>

                <Pressable
                  disabled={!editName.trim()}
                  onPress={handleConfirmEditName}
                  style={[
                    styles.modalConfirm,
                    !editName.trim() && styles.modalConfirmDisabled,
                  ]}
                >
                  <Text style={styles.modalConfirmText}>
                    {editingList ? "Guardar" : "Crear"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const quickStyles = StyleSheet.create({
  wrapper: {
    width: "100%",
    maxWidth: "100%",
    marginTop: 12,
    marginBottom: 8,
    overflow: "hidden",
  },

  title: {
    marginBottom: 12,
    color: "#374151",
    fontSize: 20,
    fontWeight: "700",
  },

  scrollContainer: {
    width: "100%",
    maxWidth: "100%",
  },

  scrollContent: {
    paddingBottom: 4,
  },

  card: {
    width: 104,
    minHeight: 92,
    marginRight: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#BFD7FF",
    borderRadius: 14,
  },

  cardPressed: {
    opacity: 0.8,
  },

  iconBox: {
    width: 42,
    height: 42,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 21,
  },

  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    borderRadius: 9,
  },

  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  label: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    backgroundColor: "#FAFAFA",
  },

  safeArea: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
  },

  content: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    paddingTop: 24,
    paddingHorizontal: 20,
  },

  title: {
    marginBottom: 8,
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
  },

  subtitle: {
    marginBottom: 18,
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
  },

  list: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
  },

  listContent: {
    paddingTop: 12,
    paddingBottom: 120,
  },

  listHeader: {
    marginBottom: 12,
    color: "#374151",
    fontSize: 20,
    fontWeight: "700",
  },

  card: {
    marginBottom: 14,
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#BFD7FF",
    borderRadius: 14,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  nameRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  name: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: "700",
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },

  metaLabel: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },

  count: {
    color: "#6B7280",
    fontSize: 13,
  },

  emptyBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },

  emptyText: {
    marginTop: 40,
    color: "#888",
    fontSize: 15,
    textAlign: "center",
  },

  emptyHint: {
    marginTop: 6,
    color: "#9CA3AF",
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  modalCard: {
    width: "85%",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
  },

  modalTitle: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: "700",
  },

  modalInput: {
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },

  modalCancel: {
    padding: 10,
  },

  modalConfirm: {
    padding: 10,
    backgroundColor: "#16a34a",
    borderRadius: 8,
  },

  modalConfirmDisabled: {
    opacity: 0.5,
  },

  modalConfirmText: {
    color: "#fff",
  },
});
