import React, { ReactNode, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

import { DialogOptions, registerDialog } from "./dialog";
import DialogModal from "./DialogModal";
import WebAlertModal from "./WebAlertModal";
import ActionSheetModal from "./ActionSheetModal";

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const resolverRef = useRef<((v: number) => void) | null>(null);

  useEffect(() => {
    registerDialog((options: DialogOptions) => {
      if (Platform.OS !== "web" && options.type !== "actionSheet") {
        return nativeAlert(options);
      }

      setDialog(options);

      return new Promise<number>((resolve) => {
        resolverRef.current = resolve;
      });
    });
  }, []);

  const close = (value: number) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  };

  return (
    <>
      {children}

      {Platform.OS === "web" && dialog?.type !== "actionSheet" && (
        <WebAlertModal dialog={dialog} onSelect={(i: number) => close(i)} />
      )}

      {Platform.OS !== "web" && dialog?.type !== "actionSheet" && (
        <DialogModal dialog={dialog} onSelect={(i: number) => close(i)} />
      )}

      {dialog?.type === "actionSheet" && (
        <ActionSheetModal dialog={dialog} onSelect={(i: number) => close(i)} />
      )}
    </>
  );
}

function nativeAlert(options: DialogOptions) {
  return new Promise<number>((resolve) => {
    const buttons =
      options.buttons?.map((b, index) => ({
        text: b.text,
        style: b.style,
        onPress: () => resolve(index),
      })) ?? [{ text: "OK", onPress: () => resolve(0) }];

    Alert.alert(options.title ?? "", options.message ?? "", buttons);
  });
}