import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";

export default function SegmentedControl({ options, value, onChange }: any) {
  return (
    <View style={styles.row}>
      {options.map((o: any) => (
        <Pressable
          key={o}
          style={[styles.button, value === o && styles.active]}
          onPress={() => onChange(o)}
        >
          <Text style={value === o ? styles.textActive : styles.text}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },

  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },

  active: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },

  text: {
    color: "#333",
  },

  textActive: {
    color: "#fff",
    fontWeight: "600",
  },
});
