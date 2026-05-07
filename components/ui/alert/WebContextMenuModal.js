import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export default function WebContextMenuModal({ dialog, onSelect, onClose }) {
  if (!dialog) return null;

  const buttons = dialog.buttons ?? [];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {!!dialog.title && <Text style={styles.title}>{dialog.title}</Text>}

          {!!dialog.message && (
            <Text style={styles.message}>{dialog.message}</Text>
          )}

          <View style={styles.list}>
            {buttons.map((b, i) => (
              <Pressable
                key={b.key ?? b.text ?? String(i)}
                onPress={() => onSelect(i)}
                style={styles.item}
              >
                <Text
                  style={[
                    styles.itemText,
                    b.style === "destructive" && styles.destructiveText,
                    b.style === "cancel" && styles.cancelText,
                  ]}
                >
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.22)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  sheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },

  message: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6b7280",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },

  list: {
    marginTop: 4,
  },

  item: {
    minHeight: 48,
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  itemText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },

  destructiveText: {
    color: "#dc2626",
  },

  cancelText: {
    color: "#2563eb",
  },
});
