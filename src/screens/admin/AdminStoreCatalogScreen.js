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
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Catálogo de supermercados</Text>
          <Text style={styles.subtitle}>
            Exporta el catálogo actual o importa el mismo formato JSON. Solo
            los administradores pueden modificarlo.
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.secondaryButton}
            disabled={busy}
            onPress={requestImport}
          >
            <Ionicons name="download-outline" size={21} color="#2563EB" />
            <Text style={styles.secondaryButtonText}>Importar JSON</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            disabled={busy}
            onPress={exportCatalog}
          >
            <Ionicons name="share-outline" size={21} color="#2563EB" />
            <Text style={styles.secondaryButtonText}>Exportar JSON</Text>
          </Pressable>
        </View>
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
  screen: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
    flexWrap: "wrap",
  },
  headerText: { flex: 1, minWidth: 220 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  title: { fontSize: 22, fontWeight: "900", color: "#111827" },
  subtitle: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 3,
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  secondaryButtonText: { fontSize: 13, fontWeight: "800", color: "#2563eb" },
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
    margin: 20,
  },
  noticeText: { flex: 1, color: "#92400E", lineHeight: 19 },
});
