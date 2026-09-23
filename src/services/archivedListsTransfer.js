import { Platform, Share } from "react-native";
import * as DocumentPicker from "expo-document-picker";

const ARCHIVED_LISTS_FORMAT = "shopp-archived-lists";

function filenameForNow() {
  const now = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `shopp-listas-archivadas-${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}.json`;
}

async function saveJsonFile(fileName, payload) {
  const json = JSON.stringify(payload, null, 2);

  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "Archivo JSON de Shopp", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return true;
      } catch (error) {
        if (String(error?.name || "") === "AbortError") return false;
      }
    }

    if (typeof navigator !== "undefined" && typeof File !== "undefined") {
      const file = new File([json], fileName, { type: "application/json" });
      if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({ files: [file], title: fileName });
          return true;
        } catch (error) {
          if (String(error?.name || "") === "AbortError") return false;
        }
      }
    }

    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
  }

  const FileSystem = await import("expo-file-system/legacy");
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  await Share.share({ title: fileName, url: uri, message: Platform.OS === "android" ? json : undefined });
  return true;
}

async function readJsonAsset(asset) {
  if (asset?.file?.text) return JSON.parse(await asset.file.text());
  if (!asset?.uri) throw new Error("No se pudo leer el fichero seleccionado.");
  const FileSystem = await import("expo-file-system/legacy");
  const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
  return JSON.parse(text);
}

export async function exportArchivedLists(archivedLists = []) {
  if (!archivedLists.length) throw new Error("No hay listas archivadas para exportar.");
  return saveJsonFile(filenameForNow(), {
    app: "Shopp",
    type: ARCHIVED_LISTS_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    archivedLists,
  });
}

export async function pickArchivedListsImport() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const payload = await readJsonAsset(result.assets?.[0]);
  const entries = Array.isArray(payload) ? payload : payload?.archivedLists;
  if (payload?.type && payload.type !== ARCHIVED_LISTS_FORMAT) {
    throw new Error("El fichero no contiene una exportación de listas archivadas de Shopp.");
  }
  if (!Array.isArray(entries)) throw new Error("El fichero no contiene listas archivadas válidas.");

  return entries
    .filter((list) => list && typeof list === "object")
    .map((list, index) => ({
      ...list,
      id: String(list.id || `imported-archive-${Date.now()}-${index}`),
      name: String(list.name || `Lista archivada ${index + 1}`),
      items: Array.isArray(list.items) ? list.items : [],
      archived: true,
      archivedAt: list.archivedAt || list.createdAt || Date.now(),
    }));
}
