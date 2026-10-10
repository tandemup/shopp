// Copias JSON independientes; no modifica ni sincroniza los datos originales.
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";
import { api } from "@/convex/_generated/api";
import { libraryJsonApi } from "@/src/services/libraryJsonApi";

export const JSON_EXPORT_UTILITIES = [
  { id: "biblioteca", label: "Biblioteca" },
  { id: "music", label: "Music Playlist" },
  { id: "classic", label: "Classic Playlist" },
  { id: "tutoriales", label: "Tutoriales" },
  { id: "noticias", label: "Noticias" },
  { id: "escaneos", label: "Escaneos" },
  { id: "listas-compra", label: "Lista de la compra" },
  { id: "historial-compras", label: "Historial de compras" },
  { id: "listas-archivadas", label: "Listas archivadas" },
];

const formats = {
  biblioteca: "shopp-library-backup",
  music: "shopp-youtube-playlists",
  classic: "shopp-youtube-classical-playlists",
  tutoriales: "shopp-youtube-tutorials",
  noticias: "shopp-youtube-news",
  escaneos: "shopp-scanned-history",
  "listas-compra": "shopp-shopping-lists",
  "historial-compras": "shopp-purchase-history",
  "listas-archivadas": "shopp-archived-lists",
};

function filenameFor(id) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `shopp-${id}-${stamp}.json`;
}

async function playlistClientId() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.localStorage?.getItem("shopp-playlist-client-id") || undefined;
  }
  return (await AsyncStorage.getItem("shopp-playlist-client-id")) || undefined;
}

function playlistItem(item) {
  // Mismo tipo de registro que exporta PlayListScreen; conserva los metadatos
  // y las pistas sin limitar ni paginar el resultado de listMine.
  return {
    ...item,
    tracks: Array.isArray(item.tracks) ? item.tracks : [],
  };
}

export async function readUtilityExport(id, { convex, getScannedHistory, activeLists, archivedLists, purchaseHistory } = {}) {
  if (!formats[id]) throw new Error("Utilidad desconocida.");
  let data;
  if (id === "listas-compra") {
    // Las listas activas son las que muestra el contexto de compras del usuario.
    if (!Array.isArray(activeLists)) throw new Error("No están disponibles las listas de la compra.");
    data = activeLists;
  } else if (id === "listas-archivadas") {
    if (!Array.isArray(archivedLists)) {
      throw new Error("No están disponibles las listas archivadas.");
    }
    data = archivedLists;
  } else if (id === "historial-compras") {
    // Se conserva tanto el historial calculado como las listas archivadas
    // para permitir una futura restauración sin perder detalles de las compras.
    if (!Array.isArray(purchaseHistory) || !Array.isArray(archivedLists)) {
      throw new Error("No están disponibles el historial de compras y las listas archivadas.");
    }
    data = { purchaseHistory, archivedLists };
  } else if (id === "biblioteca") {
    const { folders, links } = await libraryJsonApi.getSnapshot();
    if (!Array.isArray(folders) || !Array.isArray(links)) {
      throw new Error("La instantánea de Biblioteca no contiene carpetas y enlaces válidos.");
    }
    data = { folders, links }; // Todos los bloques; no usa list() paginada ni Convex.
  } else if (id === "escaneos") {
    if (typeof getScannedHistory !== "function") throw new Error("No está disponible el historial de escaneos.");
    data = await getScannedHistory();
    if (!Array.isArray(data)) throw new Error("El historial de escaneos no es válido.");
  } else {
    if (!convex) throw new Error("No está disponible la conexión a Convex.");
    const clientId = await playlistClientId();
    if (id === "music" || id === "classic") {
      data = await convex.query(api.playlists.listMine, {
        ...(clientId ? { clientId } : {}),
        collectionType: id === "classic" ? "classical" : "playlist",
      });
    } else {
      data = await convex.query(api.tutorials.listMine, {
        ...(clientId ? { clientId } : {}),
        contentType: id === "noticias" ? "news" : "tutorial",
      });
    }
    if (!Array.isArray(data)) throw new Error("No se pudieron recuperar los datos de la utilidad.");
    data = data.map(playlistItem);
  }
  return {
    app: "Shopp",
    type: formats[id],
    version: 1,
    exportedAt: new Date().toISOString(),
    ...(id === "biblioteca"
      ? { ...data }
      : id === "escaneos" ? { items: data }
      : id === "listas-compra" ? { shoppingLists: data }
      : id === "listas-archivadas" ? { archivedLists: data }
      : id === "historial-compras" ? data
      : { playlists: data }),
  };
}

export async function saveUtilityJson(id, options = {}) {
  const data = await readUtilityExport(id, options);
  const filename = filenameFor(id);
  const json = JSON.stringify(data, null, 2);
  if (Platform.OS === "web") {
    // Safari/iPad: un fichero por gesto del usuario; evita bloquear varias descargas.
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } else {
    const FileSystem = await import("expo-file-system/legacy");
    const uri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: `Guardar ${filename}`, UTI: "public.json" });
    } else {
      throw new Error("No está disponible la opción de guardar o compartir archivos JSON en este dispositivo.");
    }
  }
  const count = id === "biblioteca" ? data.links.length
    : id === "listas-compra" ? data.shoppingLists.length
    : id === "listas-archivadas" ? data.archivedLists.length
    : id === "historial-compras" ? data.purchaseHistory.length
    : (data.items || data.playlists).length;
  return { filename, count };
}
