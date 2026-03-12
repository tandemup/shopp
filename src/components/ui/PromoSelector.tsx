import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";

export default function PromoSelector({ options, value, onChange }: any) {
  return (
    <View style={styles.row}>
      {options.map((p: any) => (
        <Pressable
          key={p.id}
          style={[styles.button, value === p.id && styles.active]}
          onPress={() => onChange(p.id)}
        >
          <Text style={value === p.id ? styles.textActive : styles.text}>
            {p.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#e5e5e5",
  },

  active: {
    backgroundColor: colors.promo,
  },

  text: {
    color: "#333",
  },

  textActive: {
    color: "#fff",
    fontWeight: "600",
  },
});
