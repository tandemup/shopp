export type DialogButtonStyle = "default" | "cancel" | "destructive";

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
}

export interface DialogOptions {
  type: "alert" | "confirm" | "prompt" | "actionSheet";
  title?: string;
  message?: string;
  buttons?: DialogButton[];
}

type DialogFn = (options: DialogOptions) => Promise<number>;

let showDialog: DialogFn | null = null;

export function registerDialog(fn: DialogFn) {
  showDialog = fn;
}

function ensure() {
  if (!showDialog) {
    throw new Error("DialogProvider not mounted");
  }
}

export function alert(title: string, message?: string) {
  ensure();
  return showDialog!({
    type: "alert",
    title,
    message,
    buttons: [{ text: "OK" }],
  });
}

export function confirm(
  title: string,
  message?: string,
  buttons?: DialogButton[]
) {
  ensure();
  return showDialog!({
    type: "confirm",
    title,
    message,
    buttons:
      buttons ??
      [
        { text: "Cancel", style: "cancel" },
        { text: "OK" },
      ],
  });
}

export function actionSheet(title: string, buttons: DialogButton[]) {
  ensure();
  return showDialog!({
    type: "actionSheet",
    title,
    buttons,
  });
}