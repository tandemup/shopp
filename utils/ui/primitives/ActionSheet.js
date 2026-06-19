import { SafeMenu } from "../../../components/ui/alert/SafeAlert";

export function showOptions(title, options = []) {
  return SafeMenu(title, "", options);
}
