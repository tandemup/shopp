import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";

export default function ActionSheetModal({ dialog, onSelect }: any) {
  if (!dialog) return null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  sheet: {
    backgroundColor: "white",
    paddingBottom: 30,
  },

  button: {
    padding: 18,
    fontSize: 16,
    textAlign: "center",
  },

  destructive: {
    color: "#ff3b30",
    fontWeight: "600",
  },
});