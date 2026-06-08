import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export default function WebAlertModal({ dialog, onSelect, onClose }) {
  if (!dialog) return null;

  const buttons =
    dialog.buttons?.length > 0
      ? dialog.buttons
      : [{ text: "Aceptar", style: "default" }];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          {!!dialog.title && <Text style={styles.title}>{dialog.title}</Text>}

          {!!dialog.message && (
            <Text style={styles.message}>{dialog.message}</Text>
          )}

          <View
            style={[
              styles.actions,
              buttons.length === 1 && styles.actionsSingle,
            ]}
          >
            {buttons.map((b, i) => (
              <Pressable
                key={b.key ?? b.text ?? String(i)}
                onPress={() => onSelect(i)}
                style={[
                  styles.actionButton,
                  b.style === "cancel" && styles.cancelButton,
                  b.style === "destructive" && styles.destructiveButton,
                ]}
              >
                <Text
                  style={[
                    styles.actionText,
                    b.style === "cancel" && styles.cancelText,
                    b.style === "destructive" && styles.destructiveText,
                  ]}
                >
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  box: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 14,
  },

  message: {
    fontSize: 18,
    lineHeight: 28,
    color: "#374151",
    marginBottom: 24,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },

  actionsSingle: {
    justifyContent: "flex-end",
  },

  actionButton: {
    minWidth: 130,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButton: {
    backgroundColor: "#dbeafe",
  },

  destructiveButton: {
    backgroundColor: "#dc2626",
  },

  actionText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },

  cancelText: {
    color: "#1e3a8a",
  },

  destructiveText: {
    color: "#fff",
  },
});
