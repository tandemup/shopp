// screens/settings/MenuScreen.js

import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ROUTES } from "../../navigation/ROUTES";
import { safeAlert } from "../../components/ui/alert/safeAlert";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import {
  clearAppStorage as clearStorage,
  clearLists as clearActiveLists,
  clearPurchaseHistory,
  clearScannedHistory,
  clearStoresData,
} from "../../src/storage";

export default function MenuScreen({ navigation }) {
  const ActionCard = ({
    icon,
    title,
    subtitle,
    onPress,
    destructive = false,
  }) => {
    const iconColor = destructive ? "#B91C1C" : "#111827";
    const tabBarHeight = useBottomTabBarHeight();

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          destructive && styles.dangerCard,
          pressed && styles.cardPressed,
        ]}
        onPress={onPress}
      >
        <View style={[styles.iconBox, destructive && styles.dangerIconBox]}>
          <Ionicons name={icon} size={28} color={iconColor} />
        </View>

        <View style={styles.cardText}>
          <Text
            style={[styles.cardTitle, destructive && styles.dangerTitle]}
            numberOfLines={1}
          >
            {title}
          </Text>

          <Text style={styles.cardSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>

        <Ionicons
          name={destructive ? "warning-outline" : "chevron-forward"}
          size={22}
          color={destructive ? "#B91C1C" : "#9CA3AF"}
        />
      </Pressable>
    );
  };

  const handleClearArchivedLists = () => {
    safeAlert(
      "Pendiente",
      "No hay una función clearArchivedLists exportada en el storage actual.",
    );
  };

  const handleReloadStores = () => {
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

            navigation.reset({
              index: 0,
              routes: [
                {
                  name: ROUTES.SHOPPING_TAB,
                  params: { screen: ROUTES.SHOPPING_LISTS },
                },
              ],
            });
          },
        },
      ],
    );
  };

  const handleClearAllStorage = () => {
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

            navigation.reset({
              index: 0,
              routes: [
                {
                  name: ROUTES.SHOPPING_TAB,
                  params: { screen: ROUTES.SHOPPING_LISTS },
                },
              ],
            });
          },
        },
      ],
    );
  };

  const goToProductSearchEngines = () => {
    navigation.navigate(ROUTES.SEARCH_ENGINE_SETTINGS, {
      type: "product",
    });
  };

  const goToBookSearchEngines = () => {
    navigation.navigate(ROUTES.SEARCH_ENGINE_SETTINGS, {
      type: "book",
    });
  };

  const goToBarcodeSettings = () => {
    navigation.navigate(ROUTES.BARCODE_SETTINGS);
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 16 }, // 👈 mucho más ajustado
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Menú</Text>
        <Text style={styles.subtitle}>
          Gestiona la configuración, el mantenimiento de datos locales y el
          almacenamiento de la aplicación.
        </Text>

        <View style={styles.actions}>
          <ActionCard
            icon="search-outline"
            title="Motores de productos"
            subtitle="Configura los motores usados para buscar productos"
            onPress={goToProductSearchEngines}
          />

          {null && (
            <ActionCard
              icon="book-outline"
              title="Motores de libros"
              subtitle="Configura los motores usados para buscar libros"
              onPress={goToBookSearchEngines}
            />
          )}

          <ActionCard
            icon="options-outline"
            title="Formatos del scanner"
            subtitle="Selecciona EAN-13, EAN-8, UPC, QR o Code 128"
            onPress={goToBarcodeSettings}
          />

          <View style={styles.dangerHeader}>
            <Text style={styles.dangerHeaderText}>Danger Zone</Text>
          </View>

          <ActionCard
            icon="trash-outline"
            title="Borrar listas activas"
            subtitle="Elimina las listas de compra que todavía no están archivadas"
            destructive
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

          <ActionCard
            icon="file-tray-outline"
            title="Borrar listas archivadas"
            subtitle="Elimina las listas guardadas como archivadas"
            destructive
            onPress={() =>
              safeAlert("Borrar listas archivadas", "¿Seguro?", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: handleClearArchivedLists,
                },
              ])
            }
          />

          <ActionCard
            icon="receipt-outline"
            title="Borrar historial de compras"
            subtitle="Limpia los registros generados a partir de compras anteriores"
            destructive
            onPress={() =>
              safeAlert("Borrar historial de compras", "¿Seguro?", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: clearPurchaseHistory,
                },
              ])
            }
          />

          <ActionCard
            icon="barcode-outline"
            title="Borrar historial de escaneos"
            subtitle="Elimina productos y códigos guardados desde el scanner"
            destructive
            onPress={() =>
              safeAlert("Borrar historial de escaneos", "¿Seguro?", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: clearScannedHistory,
                },
              ])
            }
          />

          <ActionCard
            icon="refresh-outline"
            title="Recargar tiendas"
            subtitle="Restaura las tiendas desde los datos iniciales del proyecto"
            destructive
            onPress={handleReloadStores}
          />

          <ActionCard
            icon="close-circle-outline"
            title="Borrar almacenamiento completo"
            subtitle="Elimina todos los datos locales guardados por la aplicación"
            destructive
            onPress={handleClearAllStorage}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginTop: 0,
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 24,
  },

  actions: {
    gap: 14,
  },

  card: {
    minHeight: 86,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  dangerCard: {
    borderColor: "#FECACA",
    backgroundColor: "#FFFFFF",
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  dangerIconBox: {
    backgroundColor: "#FEF2F2",
  },

  cardText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  dangerTitle: {
    color: "#B91C1C",
  },

  cardSubtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: "#6B7280",
  },

  dangerHeader: {
    marginTop: 4,
    marginBottom: -2,
  },

  dangerHeaderText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
});
