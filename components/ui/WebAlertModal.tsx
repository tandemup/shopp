import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export default function WebAlertModal({ dialog, onSelect }: any) {
  if (!dialog) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{dialog.title}</Text>

          {dialog.message && (
            <Text style={styles.message}>{dialog.message}</Text>
          )}

          <View style={styles.actions}>
            {dialog.buttons?.map((b: any, i: number) => (
              <Pressable key={i} onPress={() => onSelect(i)}>
                <Text
                  style={[
                    styles.button,
                    b.style === "destructive" && styles.destructive,
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
  },

  box: {
    width: 320,
    backgroundColor: "white",
    borderRadius: 14,
    padding: 20,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },

  message: {
    marginTop: 10,
    textAlign: "center",
    color: "#555",
  },

  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 20,
  },

  button: {
    fontSize: 16,
    color: "#007aff",
  },

  destructive: {
    color: "#ff3b30",
    fontWeight: "600",
  },
});