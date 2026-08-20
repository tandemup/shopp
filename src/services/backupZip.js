import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

import { storage } from "@/src/storage";
import { getScannedHistory, saveScannedHistory } from "@/src/services/scannerHistory";
import { createStoredZip, decodeZipText, readStoredZip } from "@/src/utils/zipStore";

const BACKUP_TYPE = "shopp-complete-backup";
const BACKUP_VERSION = 1;
const IMAGE_PREFIX = "@shopping/product-images/";
const AVATAR_PREFIX = "shopp.avatar.";
const encoder = new TextEncoder();

function filenameForNow() {
  const date = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `shopp-backup-${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}.zip`;
}

function isDataKey(key) {
  return key.startsWith("@shopping/") && !key.startsWith(IMAGE_PREFIX);
}

function isMediaKey(key) {
  return key.startsWith(IMAGE_PREFIX) || key.startsWith(AVATAR_PREFIX);
}

function safePart(value) {
  return String(value || "image").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function mergeArrays(current, incoming) {
  const result = Array.isArray(current) ? [...current] : [];
  const positions = new Map();
  result.forEach((item, index) => {
    const id = item && typeof item === "object" ? item.id ?? item.barcode ?? item._id : null;
    if (id != null) positions.set(String(id), index);
  });
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const id = item && typeof item === "object" ? item.id ?? item.barcode ?? item._id : null;
    if (id != null && positions.has(String(id))) result[positions.get(String(id))] = item;
    else {
      result.push(item);
      if (id != null) positions.set(String(id), result.length - 1);
    }
  }
  return result;
}

function mergeValues(current, incoming) {
  if (Array.isArray(incoming)) return mergeArrays(current, incoming);
  if (incoming && typeof incoming === "object") {
    return { ...(current && typeof current === "object" ? current : {}), ...incoming };
  }
  return incoming;
}

async function readAssetBytes(asset) {
  if (asset?.file?.arrayBuffer) return new Uint8Array(await asset.file.arrayBuffer());
  if (!asset?.uri) throw new Error("No se pudo leer el archivo seleccionado.");
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64ToBytes(base64);
}

export async function exportCompleteBackup({ user = null, scanHistory = [] } = {}) {
  const keys = (await storage.getAllKeys()).map(String).sort();
  const records = [];
  const mediaFiles = [];

  for (const key of keys) {
    if (isMediaKey(key)) {
      const stored = await storage.getFile(key);
      if (!stored?.blob || !(stored.blob instanceof Blob)) continue;
      const bytes = new Uint8Array(await stored.blob.arrayBuffer());
      const variant = stored.metadata?.variant || key.split("/").pop() || "image";
      const productId = key.startsWith(IMAGE_PREFIX)
        ? key.slice(IMAGE_PREFIX.length).split("/")[0]
        : key.slice(AVATAR_PREFIX.length);
      const mimeType = stored.metadata?.mimeType || stored.blob.type || "image/jpeg";
      const extension = mimeType === "image/png" ? "png" : "jpeg";
      const owner = key.startsWith(AVATAR_PREFIX) ? `avatar-${productId}` : productId;
      const path = `images/${safePart(owner)}-${safePart(variant)}.${extension}`;
      mediaFiles.push({ key, path, bytes, mimeType, metadata: stored.metadata || {}, sha256: await sha256(bytes) });
    } else if (isDataKey(key)) {
      records.push({ key, value: await storage.getRawValue(key) });
    }
  }

  const dataBytes = encoder.encode(JSON.stringify({
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    user,
    records,
    scanHistory: Array.isArray(scanHistory) ? scanHistory : [],
  }, null, 2));
  const manifest = {
    app: "Shopp",
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    platform: Platform.OS,
    data: { path: "data.json", records: records.length, sha256: await sha256(dataBytes) },
    media: mediaFiles.map(({ key, path, bytes, mimeType, metadata, sha256: hash }) => ({
      key, path, mimeType, metadata, size: bytes.length, sha256: hash,
    })),
  };
  const zipBytes = createStoredZip([
    { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
    { name: "data.json", data: dataBytes },
    ...mediaFiles.map(({ path, bytes }) => ({ name: path, data: bytes })),
  ]);
  const filename = filenameForNow();

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([zipBytes], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { filename, mediaCount: mediaFiles.length, recordCount: records.length };
  }

  const fileUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, bytesToBase64(zipBytes), { encoding: FileSystem.EncodingType.Base64 });
  return { filename, fileUri, mediaCount: mediaFiles.length, recordCount: records.length };
}

export async function restoreCompleteBackup(asset, { mode = "merge" } = {}) {
  if (mode !== "merge" && mode !== "replace") throw new Error("Modo de restauración no válido.");
  const files = readStoredZip(await readAssetBytes(asset));
  const manifestBytes = files.get("manifest.json");
  const dataBytes = files.get("data.json");
  if (!manifestBytes || !dataBytes) throw new Error("Faltan manifest.json o data.json en la copia.");
  const manifest = JSON.parse(decodeZipText(manifestBytes));
  const data = JSON.parse(decodeZipText(dataBytes));
  if (manifest.type !== BACKUP_TYPE || data.type !== BACKUP_TYPE) throw new Error("El ZIP no es una copia completa de Shopp.");
  if (manifest.version !== BACKUP_VERSION || data.version !== BACKUP_VERSION) throw new Error(`Versión de copia no compatible: ${manifest.version ?? "desconocida"}.`);
  const dataHash = await sha256(dataBytes);
  if (manifest.data?.sha256 && dataHash && dataHash !== manifest.data.sha256) throw new Error("data.json no supera la verificación de integridad.");

  for (const media of manifest.media || []) {
    if (!isMediaKey(String(media.key || "")) || !String(media.path || "").startsWith("images/")) {
      throw new Error("La copia contiene una referencia de imagen no válida.");
    }
    const bytes = files.get(media.path);
    if (!bytes) throw new Error(`Falta la imagen ${media.path}.`);
    if (bytes.length !== media.size) throw new Error(`El tamaño de ${media.path} no coincide.`);
    const mediaHash = await sha256(bytes);
    if (media.sha256 && mediaHash && mediaHash !== media.sha256) throw new Error(`La imagen ${media.path} no supera la verificación de integridad.`);
  }

  if (mode === "replace") {
    await storage.clearByPrefix("@shopping/");
    await storage.clearByPrefix(AVATAR_PREFIX);
    await saveScannedHistory([]);
  }
  for (const record of Array.isArray(data.records) ? data.records : []) {
    if (!record?.key || !isDataKey(String(record.key))) continue;
    const current = mode === "merge" ? await storage.getRawValue(record.key) : null;
    await storage.setRawValue(record.key, mode === "merge" ? mergeValues(current, record.value) : record.value);
  }
  const currentHistory = mode === "merge" ? await getScannedHistory() : [];
  await saveScannedHistory(mode === "merge" ? mergeArrays(currentHistory, data.scanHistory) : data.scanHistory || []);

  for (const media of manifest.media || []) {
    if (mode === "merge" && (await storage.getFile(media.key))) continue;
    const bytes = files.get(media.path);
    if (Platform.OS === "web") {
      await storage.setFile(media.key, new Blob([bytes], { type: media.mimeType || "application/octet-stream" }), media.metadata || {});
    } else {
      const temporaryUri = `${FileSystem.cacheDirectory}shopp-restore-${Date.now()}-${safePart(media.path)}`;
      await FileSystem.writeAsStringAsync(temporaryUri, bytesToBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
      try {
        await storage.setFile(media.key, temporaryUri, media.metadata || {});
      } finally {
        await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
      }
    }
  }
  return { mode, recordCount: data.records?.length || 0, mediaCount: manifest.media?.length || 0 };
}
