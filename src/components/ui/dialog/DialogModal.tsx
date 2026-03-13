import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export default function DialogModal({ dialog, onSelect }: any) {
  if (!dialog) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          {dialog.title && <Text style={styles.title}>{dialog.title}</Text>}

          {dialog.message && (
            <Text style={styles.message}>{dialog.message}</Text>
          )}

          <View style={styles.actions}>
            {dialog.buttons?.map((b: any, i: number) => (
              <Pressable
                key={i}
                style={styles.action}
                onPress={() => onSelect(i)}
              >
                <Text
                  style={[
                    styles.button,
                    b.style === "destructive" && styles.destructive,
                    b.style === "cancel" && styles.cancel,
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
    width: "90%",
    maxWidth: 360,
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
    marginTop: 8,
    color: "#666",
    textAlign: "center",
  },

  actions: {
    flexDirection: "column",
    width: "100%",
    marginTop: 20,
  },

  action: {
    width: "100%",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: "#eee",
  },

  button: {
    fontSize: 16,
    textAlign: "center",
    color: "#007aff",
  },

  destructive: {
    color: "#ff3b30",
    fontWeight: "600",
  },

  cancel: {
    fontWeight: "600",
  },
});
