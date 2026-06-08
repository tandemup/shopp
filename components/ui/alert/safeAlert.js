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
  const safeTitle = title ?? "";
  const safeMessage = message ?? "";

  if (!buttons || buttons.length === 0) {
    window.alert(`${safeTitle}\n\n${safeMessage}`);
    return;
  }

  if (buttons.length === 1) {
    window.alert(`${safeTitle}\n\n${safeMessage}`);
    buttons[0]?.onPress?.();
    return;
  }

  if (buttons.length === 2) {
    const cancelButton =
      buttons.find((button) => button?.style === "cancel") ?? buttons[0];

    const confirmButton =
      buttons.find((button) => button !== cancelButton) ?? buttons[1];

    const accepted = window.confirm(`${safeTitle}\n\n${safeMessage}`);

    if (accepted) {
      confirmButton?.onPress?.();
    } else {
      cancelButton?.onPress?.();
    }

    return;
  }

  const options = buttons
    .map(
      (button, index) =>
        `${index + 1}. ${button.text || `Opción ${index + 1}`}`,
    )
    .join("\n");

  const answer = window.prompt(
    `${safeTitle}\n\n${safeMessage}\n\n${options}\n\nIntroduce el número de la opción:`,
    "1",
  );

  if (answer === null) {
    const cancelButton = buttons.find((button) => button?.style === "cancel");

    cancelButton?.onPress?.();
    return;
  }

  const selectedIndex = Number.parseInt(answer, 10) - 1;
  const selectedButton = buttons[selectedIndex];

  if (selectedButton) {
    selectedButton.onPress?.();
    return;
  }

  const cancelButton = buttons.find((button) => button?.style === "cancel");

  cancelButton?.onPress?.();
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
