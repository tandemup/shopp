import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  total: number;
  savings: number;
  onCheckout?: () => void;
};

export default function FooterTotal({ total, savings, onCheckout }: Props) {
  const disabled = total <= 0;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {/* INFO */}
      <View style={styles.info}>
        <Text style={styles.label}>Total</Text>

        <View style={styles.row}>
          {/* IZQUIERDA (ahorro) */}
          <View>
            {savings > 0 && (
              <Text style={styles.savings}>Ahorro {savings.toFixed(2)} €</Text>
            )}
          </View>

          {/* DERECHA (total) */}
          <View style={styles.totalBox}>
            <Text style={[styles.total, disabled && styles.totalDisabled]}>
              {total.toFixed(2)} €
            </Text>
          </View>
        </View>
      </View>

      {/* BOTÓN */}
      <Pressable
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={onCheckout}
        disabled={disabled}
      >
        <Text style={styles.buttonText}>Finalizar compra</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,

    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderColor: "#e5e7eb",

    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },

  info: {
    marginBottom: 8,
  },

  label: {
    fontSize: 12,
    color: "#666",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // 🔥 clave
    marginTop: 2,
  },

  totalBox: {
    alignItems: "flex-end",
  },

  total: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },

  totalDisabled: {
    color: "#9ca3af",
  },

  savings: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "600",
  },

  button: {
    backgroundColor: "#22c55e",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  buttonDisabled: {
    backgroundColor: "#9ca3af",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
