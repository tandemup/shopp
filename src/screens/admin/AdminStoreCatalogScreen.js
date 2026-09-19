import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useConvex, useMutation } from "convex/react";
import { I18nText as Text } from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const FORMAT = "shopp-supermarkets";
const VERSION = 1;

export default function AdminStoreCatalogScreen() {
  const convex = useConvex();
  const importCatalog = useMutation(api.stores.importCatalogForAdmin);
  const [busy, setBusy] = useState(false);

  const exportCatalog = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const stores = await convex.query(api.stores.exportCatalogForAdmin, {});
      const payload = JSON.stringify(
        {
          app: "Shopp",
          format: FORMAT,
          version: VERSION,
          exportedAt: new Date().toISOString(),
          stores,
        },
        null,
        2,
      );
      const filename = `shopp-supermercados-${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([payload], { type: "application/json;charset=utf-8" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const uri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(uri, payload, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Share.share({
          title: filename,
          url: uri,
          message: Platform.OS === "android" ? payload : undefined,
        });
      }
    } catch (error) {
      safeAlert("Error", error?.message || "No se pudo exportar el catálogo.");
    } finally {
      setBusy(false);
    }
  };

  const chooseImportFile = async (mode) => {
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      const text =
        Platform.OS === "web" && asset?.file
          ? await asset.file.text()
          : await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
      const parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
      if (
        parsed?.format !== FORMAT ||
        parsed?.version !== VERSION ||
        !Array.isArray(parsed?.stores)
      ) {
        throw new Error(
          "El fichero no es un catálogo de supermercados compatible.",
        );
      }
      const resultImport = await importCatalog({ stores: parsed.stores, mode });
      safeAlert(
        "Importación terminada",
        `${resultImport.total} supermercados procesados: ${resultImport.inserted} nuevos y ${resultImport.updated} actualizados.`,
      );
    } catch (error) {
      safeAlert(
        "Error de importación",
        error?.message || "No se pudo importar el catálogo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const requestImport = () => {
    safeAlert("Importar catálogo", "¿Cómo quieres aplicar el JSON?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Combinar", onPress: () => chooseImportFile("merge") },
      {
        text: "Reemplazar todo",
        style: "destructive",
        onPress: () => chooseImportFile("replace"),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Catálogo de supermercados</Text>
      <Text style={styles.subtitle}>
        Exporta el catálogo actual o importa el mismo formato JSON. Solo los
        administradores pueden modificarlo.
      </Text>
      <View style={styles.card}>
        <Pressable
          style={styles.button}
          disabled={busy}
          onPress={exportCatalog}
        >
          <Ionicons name="cloud-upload-outline" size={23} color="#2563EB" />
          <View style={styles.buttonText}>
            <Text style={styles.buttonTitle}>Exportar JSON</Text>
            <Text style={styles.buttonSubtitle}>
              Descargar todos los supermercados
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color="#9CA3AF" />
        </Pressable>
        <Pressable
          style={styles.button}
          disabled={busy}
          onPress={requestImport}
        >
          <Ionicons name="cloud-download-outline" size={23} color="#2563EB" />
          <View style={styles.buttonText}>
            <Text style={styles.buttonTitle}>Importar JSON</Text>
            <Text style={styles.buttonSubtitle}>
              Combinar o reemplazar el catálogo
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color="#9CA3AF" />
        </Pressable>
      </View>
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color="#2563EB" />
          <Text style={styles.busyText}>Procesando…</Text>
        </View>
      ) : null}
      <View style={styles.notice}>
        <Ionicons name="warning-outline" size={21} color="#92400E" />
        <Text style={styles.noticeText}>
          “Reemplazar todo” elimina el catálogo actual antes de importar. Las
          listas de compra no se borran.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9FAFB", padding: 20 },
  title: { fontSize: 27, fontWeight: "800", color: "#111827", marginBottom: 8 },
  subtitle: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    overflow: "hidden",
  },
  button: {
    minHeight: 78,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  buttonText: { flex: 1 },
  buttonTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  buttonSubtitle: { color: "#6B7280", marginTop: 3 },
  busy: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
  },
  busyText: { color: "#6B7280" },
  notice: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 14,
    marginTop: 22,
  },
  noticeText: { flex: 1, color: "#92400E", lineHeight: 19 },
});
