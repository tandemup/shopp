import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { I18nText as Text } from "@/src/i18n";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useConvex, useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const FORMAT = "shopp-supermarkets";
const VERSION = 1;

async function requestExportDestination(filename) {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof window.showSaveFilePicker === "function"
  ) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Catálogo de supermercados de Shopp (JSON)",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      return { kind: "web", handle };
    } catch (error) {
      if (String(error?.name || "") === "AbortError") {
        return { cancelled: true };
      }
      throw error;
    }
  }

  if (
    Platform.OS === "android" &&
    FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync
  ) {
    const permission =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    return permission.granted && permission.directoryUri
      ? { kind: "android", directoryUri: permission.directoryUri }
      : { cancelled: true };
  }

  return null;
}

function downloadJsonOnWeb(filename, payload) {
  const url = URL.createObjectURL(
    new Blob([payload], { type: "application/json;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function saveJsonOnWeb(filename, payload) {
  // Safari en iPhone/iPad no implementa showSaveFilePicker. Compartir un
  // fichero abre el panel de iPadOS y permite elegir "Guardar en Archivos",
  // incluida una unidad USB conectada.
  if (typeof navigator !== "undefined" && typeof File !== "undefined") {
    const file = new File([payload], filename, { type: "application/json" });
    const canShareFile =
      typeof navigator.share === "function" &&
      (typeof navigator.canShare !== "function" ||
        navigator.canShare({ files: [file] }));

    if (canShareFile) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (error) {
        if (String(error?.name || "") === "AbortError") return;
      }
    }
  }

  downloadJsonOnWeb(filename, payload);
}

export default function AdminStoreCatalogScreen() {
  const convex = useConvex();
  const importCatalog = useMutation(api.stores.importCatalogForAdmin);
  const [busy, setBusy] = useState(false);
  const [importModeVisible, setImportModeVisible] = useState(false);
  const [pendingImportAsset, setPendingImportAsset] = useState(null);

  const exportCatalog = async () => {
    if (busy) return;
    try {
      const filename = `shopp-supermercados-${new Date().toISOString().slice(0, 10)}.json`;
      // El selector se abre antes de preparar los datos para conservar el gesto
      // de usuario que exige el navegador y permitir elegir carpeta o unidad USB.
      const destination = await requestExportDestination(filename);
      if (destination?.cancelled) return;

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

      if (destination?.kind === "web" && destination.handle?.createWritable) {
        const writable = await destination.handle.createWritable();
        await writable.write(payload);
        await writable.close();
      } else if (destination?.kind === "android" && destination.directoryUri) {
        const uri = await FileSystem.StorageAccessFramework.createFileAsync(
          destination.directoryUri,
          filename,
          "application/json",
        );
        await FileSystem.writeAsStringAsync(uri, payload, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else if (Platform.OS === "web") {
        await saveJsonOnWeb(filename, payload);
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

  const importCatalogFile = async (asset, mode) => {
    try {
      setBusy(true);
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

  const requestImport = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) throw new Error("No se pudo leer el fichero seleccionado.");
      setPendingImportAsset(asset);
      setImportModeVisible(true);
    } catch (error) {
      safeAlert(
        "Error al seleccionar el fichero",
        error?.message || "No se pudo abrir el selector de ficheros.",
      );
    } finally {
      setBusy(false);
    }
  };

  const selectImportMode = async (mode) => {
    const asset = pendingImportAsset;
    setImportModeVisible(false);
    setPendingImportAsset(null);
    if (asset) await importCatalogFile(asset, mode);
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
      <Modal
        visible={importModeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) {
            setImportModeVisible(false);
            setPendingImportAsset(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.importModeCard}>
            <Text style={styles.modalTitle}>Importar catálogo</Text>
            <Text style={styles.modalSubtitle}>
              El fichero seleccionado es {pendingImportAsset?.name || "el JSON"}.
              Elige cómo quieres aplicarlo al catálogo.
            </Text>
            <Pressable
              disabled={busy}
              onPress={() => selectImportMode("merge")}
              style={styles.importModeButton}
            >
              <Ionicons name="git-merge-outline" size={20} color="#2563eb" />
              <View style={styles.importModeButtonText}>
                <Text style={styles.importModeTitle}>Combinar</Text>
                <Text style={styles.importModeDescription}>
                  Conserva el catálogo actual y añade o actualiza los
                  supermercados del fichero.
                </Text>
              </View>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => selectImportMode("replace")}
              style={[styles.importModeButton, styles.importModeReplaceButton]}
            >
              <Ionicons name="trash-outline" size={20} color="#b91c1c" />
              <View style={styles.importModeButtonText}>
                <Text style={[styles.importModeTitle, styles.importModeReplaceTitle]}>
                  Reemplazar todo
                </Text>
                <Text style={styles.importModeDescription}>
                  Elimina el catálogo actual y lo sustituye por el contenido
                  del fichero. Las listas de compra no se borran.
                </Text>
              </View>
            </Pressable>
            <View style={styles.importModeActions}>
              <Pressable
                disabled={busy}
                onPress={() => {
                  setImportModeVisible(false);
                  setPendingImportAsset(null);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
  },
  importModeCard: {
    width: 520,
    maxWidth: "92%",
    gap: 12,
    padding: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#111827" },
  modalSubtitle: { fontSize: 15, color: "#64748b" },
  importModeButton: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  importModeReplaceButton: {
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
  },
  importModeButtonText: { flex: 1, minWidth: 0 },
  importModeTitle: { fontSize: 14, fontWeight: "900", color: "#1d4ed8" },
  importModeReplaceTitle: { color: "#b91c1c" },
  importModeDescription: { marginTop: 3, fontSize: 12, color: "#475569" },
  importModeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 2,
  },
});
