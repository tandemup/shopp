// components/ActionMenuModal.js
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";

export default function ActionMenuModal({
  visible,
  title,
  actions = [],
  onClose,
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.container}>
          {title && <Text style={styles.title}>{title}</Text>}

          {actions.map((a, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.action}
              onPress={() => {
                onClose();
                a.onPress?.();
              }}
            >
              <Text style={[styles.label, a.destructive && styles.destructive]}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.action, styles.cancel]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  action: {
    paddingVertical: 14,
  },
  label: {
    fontSize: 16,
    textAlign: "center",
  },
  destructive: {
    color: "#d32f2f",
    fontWeight: "700",
  },
  cancel: {
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  cancelText: {
    textAlign: "center",
    fontWeight: "600",
  },
});
