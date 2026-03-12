import { StyleSheet, Text } from "react-native";
import { colors } from "../../theme/colors";

export default function SectionLabel({ children }: { children: any }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
    marginTop: 12,
  },
});
