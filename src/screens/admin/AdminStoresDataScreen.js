import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { I18nText as Text } from "@/src/i18n";

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

function buildExportFilename() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");

  return `shopp-stores-${stamp}.json`;
}

function downloadJsonOnWeb(filename, json) {
  if (typeof document === "undefined") {
    throw new Error("El navegador no está disponible.");
  }

  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function saveJsonFile(filename, json) {
  if (Platform.OS === "web") {
    downloadJsonOnWeb(filename, json);
    return { platform: "web" };
  }

  if (!FileSystem.documentDirectory) {
    throw new Error("No hay almacenamiento local disponible.");
  }

  const fileUri = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { platform: Platform.OS, fileUri };
}

function normalizeImportedStore(store, index) {
  const id = String(store?.id ?? "").trim();
  const name = String(store?.name ?? "").trim();
  const city = String(store?.city ?? "gijon").trim() || "gijon";
  const provincia =
    String(store?.provincia ?? "Asturias").trim() || "Asturias";
  const address = String(store?.address ?? "").trim();
  const zipcode = Number(store?.zipcode ?? 0);
  const lat = Number(store?.location?.lat);
  const lng = Number(store?.location?.lng);

  if (!id || !name) {
    throw new Error(`La tienda ${index + 1} debe tener id y nombre.`);
  }

  if (!Number.isFinite(zipcode)) {
    throw new Error(`La tienda ${name} tiene un código postal no válido.`);
  }

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error(`La tienda ${name} tiene coordenadas no válidas.`);
  }

  return {
    id,
    name,
    city,
    provincia,
    address,
    zipcode: Math.trunc(zipcode),
    location: {
      lat,
      lng,
      source: String(store?.location?.source ?? "import").trim() || "import",
    },
  };
}

async function readStoresFromDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    throw new Error("No se pudo leer el archivo seleccionado.");
  }

  const text = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const payload = JSON.parse(text);
  const stores = Array.isArray(payload) ? payload : payload?.stores;

  if (!Array.isArray(stores)) {
    throw new Error("El JSON debe contener un array de tiendas.");
  }

  return stores.map(normalizeImportedStore);
}

export default function AdminStoresDataScreen() {
  const currentUser = useQuery(api.users.current);
  const isAdmin =
    currentUser?.isAdmin === true || currentUser?.role === "admin";
  const exportedData = useQuery(
    api.stores.exportStoresJson,
    isAdmin ? {} : "skip",
  );
  const importStores = useMutation(api.stores.importStoresJson);
  const [busy, setBusy] = useState(null);

  const storeCount = exportedData?.stores?.length ?? 0;
  const exportDescription = useMemo(
    () =>
      exportedData === undefined
        ? "Consultando tiendas..."
        : `${storeCount} ${storeCount === 1 ? "tienda disponible" : "tiendas disponibles"}`,
    [exportedData, storeCount],
  );

  const handleExport = async () => {
    if (busy || !exportedData) return;

    try {
      setBusy("export");
      const filename = buildExportFilename();
      const json = `${JSON.stringify(exportedData, null, 2)}\n`;
      const result = await saveJsonFile(filename, json);

      safeAlert(
        "Exportación completada",
        result.platform === "web"
          ? `Se ha descargado ${filename}.`
          : `Se ha guardado ${filename} en el almacenamiento local de la app.`,
      );
    } catch (error) {
      safeAlert("Error al exportar", error?.message || "No se pudo exportar.");
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    if (busy) return;

    try {
      setBusy("import");
      const stores = await readStoresFromDocument();

      if (!stores) return;

      if (stores.length === 0) {
        safeAlert("Sin tiendas", "El archivo no contiene tiendas para importar.");
        return;
      }

      const result = await importStores({ stores });

      safeAlert(
        "Importación completada",
        [
          `Tiendas procesadas: ${result.total}`,
          `Nuevas: ${result.inserted}`,
          `Actualizadas: ${result.updated}`,
        ].join("\n"),
      );
    } catch (error) {
      safeAlert("Error al importar", error?.message || "No se pudo importar.");
    } finally {
      setBusy(null);
    }
  };

  if (currentUser === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Comprobando permisos...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={42} color="#dc2626" />
        <Text style={styles.deniedTitle}>Acceso restringido</Text>
        <Text style={styles.deniedText}>
          Esta pantalla solo está disponible para administradores.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerIconBox}>
        <Ionicons name="cloud-outline" size={30} color="#1d4ed8" />
      </View>
      <Text style={styles.title}>Datos de tiendas</Text>
      <Text style={styles.subtitle}>
        Importa o exporta el catálogo de tiendas en formato JSON. Las
        operaciones se validan también en Convex.
      </Text>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Catálogo actual</Text>
        <Text style={styles.summaryText}>{exportDescription}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy === "export" || exportedData === undefined}
        onPress={handleExport}
        style={({ pressed }) => [
          styles.action,
          pressed && styles.pressed,
          (busy === "export" || exportedData === undefined) && styles.disabled,
        ]}
      >
        <Ionicons name="download-outline" size={24} color="#1d4ed8" />
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Exportar tiendas</Text>
          <Text style={styles.actionSubtitle}>Descargar un JSON del catálogo</Text>
        </View>
        {busy === "export" ? <ActivityIndicator color="#1d4ed8" /> : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={busy === "import"}
        onPress={handleImport}
        style={({ pressed }) => [
          styles.action,
          pressed && styles.pressed,
          busy === "import" && styles.disabled,
        ]}
      >
        <Ionicons name="cloud-upload-outline" size={24} color="#15803d" />
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>Importar tiendas</Text>
          <Text style={styles.actionSubtitle}>Seleccionar un archivo JSON</Text>
        </View>
        {busy === "import" ? <ActivityIndicator color="#15803d" /> : null}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  loadingText: { marginTop: 12, color: "#64748b" },
  deniedTitle: { marginTop: 12, fontSize: 20, fontWeight: "800", color: "#0f172a" },
  deniedText: { marginTop: 6, textAlign: "center", color: "#64748b" },
  headerIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
  },
  title: { marginTop: 16, fontSize: 28, fontWeight: "800", color: "#0f172a" },
  subtitle: { marginTop: 8, lineHeight: 22, color: "#475569" },
  summary: {
    marginTop: 24,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#e0f2fe",
  },
  summaryTitle: { fontSize: 16, fontWeight: "800", color: "#0c4a6e" },
  summaryText: { marginTop: 4, color: "#0369a1" },
  action: {
    minHeight: 76,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  actionText: { flex: 1, marginLeft: 14 },
  actionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  actionSubtitle: { marginTop: 3, color: "#64748b" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
