// Comparte una COPIA de la lista como texto, sin publicar los datos en Convex.
// El destinatario puede leerla sin cuenta de Shopp. No se sincronizan cambios.
import { Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";

function singleLine(value, fallback = "") {
  const cleaned = String(value ?? "").replace(/[\r\n\t]+/g, " ").trim();
  return cleaned || fallback;
}

function quantityLabel(item) {
  const value = Number(item?.quantity ?? item?.qty ?? item?.priceInfo?.qty ?? 1);
  const qty = Number.isFinite(value) && value > 0 ? value : 1;
  const amount = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(qty);
  const unit = singleLine(item?.unit ?? item?.priceInfo?.unit ?? "u", "u");
  return `${amount} ${unit}`;
}

export function formatShoppingListText(list) {
  if (!list || typeof list !== "object") {
    throw new Error("No se ha seleccionado una lista válida.");
  }

  const title = singleLine(list.name, "Lista de la compra");
  const items = Array.isArray(list.items) ? list.items : [];
  const lines = items.map((item) => {
    const mark = item?.checked === false ? "☐" : "☑";
    const name = singleLine(item?.name, "Producto sin nombre");
    const notes = singleLine(item?.notes);
    return `${mark} ${quantityLabel(item)} · ${name}${notes ? ` (${notes})` : ""}`;
  });

  return [
    `🛒 ${title}`,
    `${items.length} ${items.length === 1 ? "producto" : "productos"}`,
    "",
    ...(lines.length ? lines : ["Lista sin productos"]),
    "",
    "Compartido desde Shopp (copia, sin sincronización)",
  ].join("\n");
}

export async function copyShoppingList(list) {
  await Clipboard.setStringAsync(formatShoppingListText(list));
  return "copied";
}

export async function shareShoppingList(list) {
  const message = formatShoppingListText(list);
  const title = singleLine(list.name, "Lista de la compra");

  if (Platform.OS === "web") {
    // Safari/Chrome en iPhone o iPad muestran el panel de compartir del sistema.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: message });
        return "shared";
      } catch (error) {
        // Cancelar no equivale a enviar y no debe generar alertas.
        if (error?.name === "AbortError") return "cancelled";
        // Si falla Web Share, intentamos una copia al portapapeles.
      }
    }

    await Clipboard.setStringAsync(message);
    return "copied";
  }

  const result = await Share.share({ title, message }, { dialogTitle: `Compartir ${title}` });
  return result?.action === Share.dismissedAction ? "cancelled" : "shared";
}
