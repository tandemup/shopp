import React, { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import WebAlertModal from "./WebAlertModal";
import { registerWebDialogListener } from "./safeAlert";

function WebDialogHost() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    const unregister = registerWebDialogListener((nextDialog) => {
      setDialog(nextDialog);
    });

    return unregister;
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const handleSelect = useCallback(
    async (index) => {
      const selectedButton = dialog?.buttons?.[index];

      if (!selectedButton || selectedButton.disabled) {
        return;
      }

      setDialog(null);

      try {
        await selectedButton.onPress?.();
      } catch (error) {
        console.error("[DialogHost] button onPress error:", error);
      }
    },
    [dialog],
  );

  if (!dialog) {
    return null;
  }

  return (
    <WebAlertModal
      dialog={dialog}
      onSelect={handleSelect}
      onClose={closeDialog}
    />
  );
}

export default function DialogHost() {
  return Platform.OS === "web" ? <WebDialogHost /> : null;
}
