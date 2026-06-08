export function safeMenu(title, message, buttons) {
  const normalized = normalizeButtons(buttons);

  if (Platform.OS === "web") {
    if (typeof webAlertListener === "function") {
      webAlertListener({
        visible: true,
        type: "menu",
        title: title ?? "",
        message: message ?? "",
        buttons: normalized,
      });
      return;
    }
  }

  // fallback native simple
  Alert.alert(title, message, normalized);
}
