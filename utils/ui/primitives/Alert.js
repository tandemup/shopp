import { Platform, Alert as RNAlert } from "react-native";
import { showWebAlert } from "../alert/WebAlertModal";

export function showAlert(title, message, actions = []) {
  if (Platform.OS === "web") {
    return showWebAlert(title, message, actions);
  }

  return RNAlert.alert(title, message, actions);
}
