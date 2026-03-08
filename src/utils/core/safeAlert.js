// utils/safeAlert.js
import { Alert, Platform } from "react-native";

/**
 * Normaliza botones para que:
 * - admita { label } o { text }
 * - React Native reciba siempre { text }
 */
function normalizeButtons(buttons = []) {
  return buttons.map((b) => {
    if (!b) return null;

    return {
      ...b,
      text: b.text ?? b.label ?? "",
    };
  });
}

/**
 * safeAlert(title, message, buttons?)
 */
export function safeAlert(title, message, buttons) {
  // --- WEB ---
  if (Platform.OS === "web") {
    if (!buttons || buttons.length === 0) {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    if (buttons.length === 1) {
      window.alert(`${title}\n\n${message}`);
      const b = buttons[0];
      if (b?.onPress) b.onPress();
      return;
    }

    if (buttons.length >= 2) {
      const confirmResult = window.confirm(`${title}\n\n${message}`);
      if (confirmResult) {
        const positive = buttons[1];
        if (positive?.onPress) positive.onPress();
      }
      return;
    }
  }

  // --- MOBILE ---
  if (!buttons || buttons.length === 0) {
    Alert.alert(title, message);
  } else {
    const normalized = normalizeButtons(buttons);
    Alert.alert(title, message, normalized);
  }
}

/**
 * safeConfirm(title, message, onConfirm)
 */
export function safeConfirm(title, message, onConfirm) {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed && typeof onConfirm === "function") onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      { text: "Aceptar", onPress: onConfirm },
    ]);
  }
}
