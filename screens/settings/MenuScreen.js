import React from "react";
import {
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";

import { ROUTES } from "../../navigation/ROUTES";

// Ajusta estos imports a las rutas reales de tu proyecto.
// Si ya los tenías en una versión anterior del archivo, conserva tus rutas originales.
import { safeAlert } from "../../components/ui/alert/safeAlert";
import {
  clearActiveLists,
  clearPurchaseHistory,
  clearScannedHistory,
  clearStorage,
  clearStoresData,
} from "../../utils/storage";

function getPermissionLabel(permission) {
  if (!permission) return "Comprobando...";

  if (permission.granted) return "Concedido";
  if (permission.canAskAgain === false) return "Bloqueado";
  if (permission.status === "denied") return "Denegado";

  return "No solicitado";
}

function getPermissionColor(permission) {
  if (!permission) return "#64748b";

  if (permission.granted) return "#16a34a";
  if (permission.canAskAgain === false) return "#dc2626";
  if (permission.status === "denied") return "#f97316";

  return "#64748b";
}

async function handlePermissionPress(permission, requestPermission) {
  if (permission?.granted) return;

  if (permission?.canAskAgain === false) {
    await Linking.openSettings();
    return;
  }

  await requestPermission();
}

function PermissionRow({ icon, title, description, permission, onPress }) {
  const label = getPermissionLabel(permission);
  const color = getPermissionColor(permission);

  return (
    <Pressable style={styles.permissionRow} onPress={onPress}>
      <View style={styles.permissionIconBox}>
        <Ionicons name={icon} size={22} color="#0f172a" />
      </View>

      <View style={styles.permissionTextBox}>
        <Text style={styles.permissionTitle}>{title}</Text>
        <Text style={styles.permissionDescription}>{description}</Text>
      </View>

      <View style={[styles.permissionBadge, { borderColor: color }]}>
        <Text style={[styles.permissionBadgeText, { color }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function SettingsCard({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  danger = false,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        danger && styles.dangerCard,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.cardIconBox, danger && styles.dangerIconBox]}>
          <Ionicons
            name={icon}
            size={22}
            color={danger ? "#dc2626" : "#0f172a"}
          />
        </View>

        <View style={styles.cardTextBox}>
          <Text
            style={[styles.cardTitle, danger && styles.dangerText]}
            numberOfLines={1}
          >
            {title}
          </Text>

          {subtitle ? (
            <Text style={styles.cardSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardRight}>
        {badge ? (
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{badge}</Text>
          </View>
        ) : null}

        <Ionicons
          name={danger ? "warning-outline" : "chevron-forward"}
          size={20}
          color={danger ? "#dc2626" : "#94a3b8"}
        />
      </View>
    </Pressable>
  );
}

export default function MenuScreen({ navigation }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] =
    Location.useForegroundPermissions();

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

  const goToScannedHistory = () => {
    navigation.navigate(ROUTES.SCANNED_HISTORY);
  };

  const goToShoppingLists = () => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: ROUTES.SHOPPING_TAB,
          params: { screen: ROUTES.SHOPPING_LISTS },
        },
      ],
    });
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
            goToShoppingLists();
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
            goToShoppingLists();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>Shopp</Text>
            <Text style={styles.headerTitle}>Ajustes</Text>
          </View>

          <View style={styles.headerIconBox}>
            <Ionicons name="settings-outline" size={26} color="#0f172a" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Búsqueda</Text>

          <SettingsCard
            icon="search-outline"
            title="Motores de productos"
            subtitle="Google, Open Food Facts, Barcode Lookup..."
            onPress={goToProductSearchEngines}
          />

          <SettingsCard
            icon="book-outline"
            title="Motores de libros"
            subtitle="Google Books, Open Library..."
            onPress={goToBookSearchEngines}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Escáner</Text>

          <SettingsCard
            icon="barcode-outline"
            title="Configuración del código de barras"
            subtitle="Formatos admitidos: EAN-13, EAN-8..."
            onPress={goToBarcodeSettings}
          />

          <SettingsCard
            icon="time-outline"
            title="Historial de escaneos"
            subtitle="Consulta los códigos escaneados recientemente"
            onPress={goToScannedHistory}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permisos</Text>

          <View style={styles.permissionsCard}>
            <View style={styles.permissionsHeader}>
              <View style={styles.permissionsHeaderTextBox}>
                <Text style={styles.permissionsTitle}>
                  Accesos del dispositivo
                </Text>
                <Text style={styles.permissionsSubtitle}>
                  Cámara, ubicación y permisos necesarios para la app
                </Text>
              </View>

              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color="#0f172a"
              />
            </View>

            <PermissionRow
              icon="camera-outline"
              title="Cámara"
              description="Necesaria para escanear códigos de barras."
              permission={cameraPermission}
              onPress={() =>
                handlePermissionPress(cameraPermission, requestCameraPermission)
              }
            />

            <PermissionRow
              icon="location-outline"
              title="Ubicación"
              description="Necesaria para tiendas cercanas y mapas."
              permission={locationPermission}
              onPress={() =>
                handlePermissionPress(
                  locationPermission,
                  requestLocationPermission,
                )
              }
            />

            {Platform.OS === "web" ? (
              <Text style={styles.permissionNote}>
                En web, los permisos dependen del navegador y del uso de HTTPS.
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>

          <SettingsCard
            icon="trash-outline"
            title="Borrar listas activas"
            subtitle="Elimina las listas de compra que todavía no están archivadas"
            danger
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

          <SettingsCard
            icon="file-tray-outline"
            title="Borrar listas archivadas"
            subtitle="Elimina las listas guardadas como archivadas"
            danger
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

          <SettingsCard
            icon="receipt-outline"
            title="Borrar historial de compras"
            subtitle="Limpia los registros generados a partir de compras anteriores"
            danger
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

          <SettingsCard
            icon="barcode-outline"
            title="Borrar historial de escaneos"
            subtitle="Elimina productos y códigos guardados desde el scanner"
            danger
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

          <SettingsCard
            icon="refresh-outline"
            title="Recargar tiendas"
            subtitle="Restaura las tiendas desde los datos iniciales del proyecto"
            danger
            onPress={handleReloadStores}
          />

          <SettingsCard
            icon="close-circle-outline"
            title="Borrar almacenamiento completo"
            subtitle="Elimina todos los datos locales guardados por la aplicación"
            danger
            onPress={handleClearAllStorage}
          />
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  headerEyebrow: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  headerTitle: {
    marginTop: 2,
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
  },

  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  card: {
    minHeight: 76,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0f172a",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  dangerCard: {
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
  },

  cardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  dangerIconBox: {
    backgroundColor: "#fee2e2",
  },

  cardTextBox: {
    flex: 1,
    minWidth: 0,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },

  dangerText: {
    color: "#dc2626",
  },

  cardSubtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: "#64748b",
  },

  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },

  cardBadge: {
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
  },

  cardBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0369a1",
  },

  permissionsCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#0f172a",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  permissionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  permissionsHeaderTextBox: {
    flex: 1,
    paddingRight: 10,
  },

  permissionsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },

  permissionsSubtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: "#64748b",
  },

  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },

  permissionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  permissionTextBox: {
    flex: 1,
    minWidth: 0,
  },

  permissionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },

  permissionDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: "#64748b",
  },

  permissionBadge: {
    marginLeft: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },

  permissionBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },

  permissionNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#64748b",
  },

  footerSpace: {
    height: 24,
  },
});
