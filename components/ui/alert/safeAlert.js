import { Alert, Platform } from "react-native";

let webDialogListener = null;

export function registerWebDialogListener(listener) {
  webDialogListener = listener;

  return () => {
    if (webDialogListener === listener) {
      webDialogListener = null;
    }
  };
}

function normalizeButtons(buttons = []) {
  return buttons.filter(Boolean).map((b, index) => ({
    key: b.key ?? `btn-${index}`,
    text: b.text ?? b.label ?? "",
    style: b.style ?? "default", // default | cancel | destructive
    onPress: typeof b.onPress === "function" ? b.onPress : undefined,
  }));
}

function emitWebDialog(payload) {
  if (typeof webDialogListener === "function") {
    webDialogListener(payload);
    return true;
  }
  return false;
}

function safeAlertWebFallback(title, message, buttons) {
  if (!buttons || buttons.length === 0) {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  if (buttons.length === 1) {
    window.alert(`${title}\n\n${message}`);
    buttons[0]?.onPress?.();
    return;
  }

  const confirmResult = window.confirm(`${title}\n\n${message}`);
  if (confirmResult) {
    const positive = buttons.find((b) => b?.style !== "cancel") ?? buttons[1];
    positive?.onPress?.();
  }
}

export function safeAlert(title, message, buttons) {
  const normalized = normalizeButtons(buttons);

  if (Platform.OS === "web") {
    const handled = emitWebDialog({
      visible: true,
      type: "alert",
      title: title ?? "",
      message: message ?? "",
      buttons:
        normalized.length > 0
          ? normalized
          : [{ key: "ok", text: "Aceptar", style: "default" }],
    });

    if (!handled) {
      safeAlertWebFallback(title, message, normalized);
    }
    return;
  }

  if (normalized.length === 0) {
    Alert.alert(title, message);
    return;
  }

  Alert.alert(title, message, normalized);
}

export function safeConfirm(title, message, onConfirm) {
  safeAlert(title, message, [
    { text: "Cancelar", style: "cancel" },
    { text: "Aceptar", onPress: onConfirm },
  ]);
}

export function safeMenu(title, message, buttons) {
  const normalized = normalizeButtons(buttons);

  if (Platform.OS === "web") {
    const handled = emitWebDialog({
      visible: true,
      type: "menu",
      title: title ?? "",
      message: message ?? "",
      buttons: normalized,
    });

    if (handled) return;
  }

  // Fallback nativo simple usando Alert.alert
  if (normalized.length === 0) {
    Alert.alert(title, message);
    return;
  }

  Alert.alert(title, message, normalized);
}
