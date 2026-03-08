import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "../components/AppIcon";
import { ROUTES } from "../navigation/ROUTES";
import { safeAlert } from "../utils/core/safeAlert";

import {
  clearStorage,
  clearActiveLists,
  clearArchivedLists,
  clearPurchaseHistory,
  clearScannedHistory,
  clearStoresData,
} from "../utils/storage";

import {
  getGeneralSearchEngine,
  setGeneralSearchEngine,
  getBookSearchEngine,
  setBookSearchEngine,
} from "../utils/config/searchConfig";

import { SEARCH_ENGINES, BOOK_ENGINES } from "../constants/searchEngines";

/* -----------------------------------------
   📋 COMPONENTE
------------------------------------------ */
export default function MenuScreen({ navigation }) {
  // Estado local SOLO para pintar la UI
  const [generalEngine, setGeneralEngineState] = useState(null);
  const [bookEngine, setBookEngineState] = useState(null);

  /* -----------------------------------------
     🔄 Cargar configuración
  ------------------------------------------ */
  useEffect(() => {
    getGeneralSearchEngine().then(setGeneralEngineState);
    getBookSearchEngine().then(setBookEngineState);
  }, []);

  /* -----------------------------------------
     🔘 Selección
  ------------------------------------------ */
  const selectGeneralEngine = async (id) => {
    await setGeneralSearchEngine(id);
    setGeneralEngineState(id);
  };

  const selectBookEngine = async (id) => {
    await setBookSearchEngine(id);
    setBookEngineState(id);
  };

  /* -----------------------------------------
     🧱 COMPONENTES REUTILIZABLES
  ------------------------------------------ */
  const Row = ({ icon, label, onPress }) => (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <AppIcon name={icon} size={20} color="#2563eb" style={styles.rowIcon} />
      <Text style={styles.rowText}>{label}</Text>
      <AppIcon name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  const EngineOption = ({ engine, selectedId, onSelect }) => {
    const selected = selectedId === engine.id;

    return (
      <TouchableOpacity
        style={styles.configRow}
        onPress={() => onSelect(engine.id)}
      >
        <View style={styles.configLeft}>
          <AppIcon
            name={engine.icon}
            size={20}
            color={selected ? "#2563eb" : "#666"}
            style={{ marginRight: 10 }}
          />
          <Text style={styles.configLabel}>{engine.label}</Text>
        </View>

        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioInner} />}
        </View>
      </TouchableOpacity>
    );
  };

  const DangerRow = ({ icon, label, onPress }) => (
    <TouchableOpacity style={styles.dangerRow} onPress={onPress}>
      <AppIcon name={icon} size={20} color="#b91c1c" style={styles.rowIcon} />
      <Text style={styles.dangerText}>{label}</Text>
      <AppIcon name="warning" size={20} color="#b91c1c" />
    </TouchableOpacity>
  );

  function MotorGeneral() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Motor de búsqueda general</Text>
        {Object.values(SEARCH_ENGINES).map((engine) => (
          <EngineOption
            key={engine.id}
            engine={engine}
            selectedId={generalEngine}
            onSelect={selectGeneralEngine}
          />
        ))}
      </View>
    );
  }

  function MotorLibros() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Motor para libros</Text>
        {Object.values(BOOK_ENGINES).map((engine) => (
          <EngineOption
            key={engine.id}
            engine={engine}
            selectedId={bookEngine}
            onSelect={selectBookEngine}
          />
        ))}
      </View>
    );
  }

  /* -----------------------------------------
     🖥 RENDER
  ------------------------------------------ */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.title}>Menú</Text>

        {/* NAVEGACIÓN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navegación</Text>

          <Row
            icon="list"
            label="Mis listas"
            onPress={() =>
              navigation.navigate(ROUTES.SHOPPING_TAB, {
                screen: ROUTES.SHOPPING_LISTS,
              })
            }
          />
          <Row
            icon="archive"
            label="Listas archivadas"
            onPress={() =>
              navigation.navigate(ROUTES.SHOPPING_TAB, {
                screen: ROUTES.ARCHIVED_LISTS,
              })
            }
          />
          <Row
            icon="receipt"
            label="Historial de compras"
            onPress={() =>
              navigation.navigate(ROUTES.SHOPPING_TAB, {
                screen: ROUTES.PURCHASE_HISTORY,
              })
            }
          />
          <Row
            icon="barcode"
            label="Historial de escaneos"
            onPress={() =>
              navigation.navigate(ROUTES.SHOPPING_TAB, {
                screen: ROUTES.SCANNED_HISTORY,
              })
            }
          />
        </View>

        <MotorGeneral />
        {/* <MotorLibros /> */}

        {/* MANTENIMIENTO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mantenimiento</Text>

          <DangerRow
            icon="trash"
            label="Borrar listas activas"
            onPress={() =>
              safeAlert("Borrar listas activas", "¿Seguro?", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: clearActiveLists,
                },
              ])
            }
          />

          <DangerRow
            icon="trash-bin"
            label="Borrar listas archivadas"
            onPress={() =>
              safeAlert("Borrar listas archivadas", "¿Seguro?", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: clearArchivedLists,
                },
              ])
            }
          />

          <DangerRow
            icon="documents"
            label="Borrar historial de compras"
            onPress={() =>
              safeAlert("Borrar historial", "¿Seguro?", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: clearPurchaseHistory,
                },
              ])
            }
          />

          <DangerRow
            icon="barcode"
            label="Borrar historial de escaneos"
            onPress={() =>
              safeAlert("Borrar historial", "¿Seguro?", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: clearScannedHistory,
                },
              ])
            }
          />

          <DangerRow
            icon="refresh"
            label="Recargar tiendas desde datos iniciales"
            onPress={() =>
              safeAlert(
                "Recargar tiendas",
                "Se eliminarán los cambios locales en tiendas y se volverán a cargar desde los datos iniciales. ¿Continuar?",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Recargar",
                    style: "destructive",
                    onPress: async () => {
                      await clearStoresData();
                      setTimeout(() => {
                        navigation.reset({
                          index: 0,
                          routes: [
                            {
                              name: ROUTES.SHOPPING_TAB,
                              params: { screen: ROUTES.SHOPPING_LISTS },
                            },
                          ],
                        });
                      }, 50);
                    },
                  },
                ],
              )
            }
          />

          <DangerRow
            icon="close-circle"
            label="Borrar almacenamiento completo"
            onPress={() =>
              safeAlert(
                "Borrar almacenamiento",
                "¿Seguro? Esta acción no se puede deshacer.",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Borrar todo",
                    style: "destructive",
                    onPress: async () => {
                      await clearStorage();
                      setTimeout(() => {
                        navigation.reset({
                          index: 0,
                          routes: [
                            {
                              name: ROUTES.SHOPPING_TAB,
                              params: { screen: ROUTES.SHOPPING_LISTS },
                            },
                          ],
                        });
                      }, 50);
                    },
                  },
                ],
              )
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -----------------------------------------
   🎨 ESTILOS
------------------------------------------ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginVertical: 20,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#555",
    paddingLeft: 16,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f3f3",
  },
  rowIcon: { marginRight: 12 },
  rowText: {
    flex: 1,
    fontSize: 16,
    color: "#222",
    fontWeight: "500",
  },
  configRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f3f3",
  },
  configLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  configLabel: {
    fontSize: 16,
    color: "#222",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#aaa",
    justifyContent: "center",
    alignItems: "center",
  },
  radioSelected: {
    borderColor: "#2563eb",
  },
  radioInner: {
    width: 12,
    height: 12,
    backgroundColor: "#2563eb",
    borderRadius: 6,
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff1f2",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#ffe4e6",
  },
  dangerText: {
    flex: 1,
    fontSize: 16,
    color: "#b91c1c",
    fontWeight: "700",
  },
});
