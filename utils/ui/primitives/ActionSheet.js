import { Platform } from "react-native";
import { showActionSheet } from "../actionsheet/ActionSheetModal";
import { showAlert } from "./Alert";

export function showOptions(title, options) {
  if (Platform.OS === "web") {
    return showActionSheet(title, options);
  }

  // fallback simple native
  return showAlert(title, "", options);
}
