import { Pressable, StyleSheet, Text, View } from "react-native";

export default function TotalBar({ total }) {
  return (
    <View style={styles.container}>
      <Text style={styles.total}>Total: {total.toFixed(2)} €</Text>

      <Pressable style={styles.button}>
        <Text style={styles.text}>Finalizar compra</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#ddd",
  },

  total: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },

  button: {
    backgroundColor: "#28c76f",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  text: {
    color: "white",
    fontWeight: "600",
  },
});
