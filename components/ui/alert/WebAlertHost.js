import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import WebAlertModal from "./WebAlertModal";
import WebContextMenuModal from "./WebContextMenuModal";
import { registerWebDialogListener } from "./safeAlert";

export default function WebAlertHost() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const unsubscribe = registerWebDialogListener((payload) => {
      setDialog(payload);
    });

    return unsubscribe;
  }, []);

  if (Platform.OS !== "web") return null;

  const close = () => {
    setDialog(null);
  };

  const handleSelect = (index) => {
    const button = dialog?.buttons?.[index];
    close();

    requestAnimationFrame(() => {
      button?.onPress?.();
    });
  };

  if (!dialog) return null;

  if (dialog.type === "menu") {
    return (
      <WebContextMenuModal
        dialog={dialog}
        onClose={close}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <WebAlertModal dialog={dialog} onClose={close} onSelect={handleSelect} />
  );
}
