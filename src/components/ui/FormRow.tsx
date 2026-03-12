import { StyleSheet, View } from "react-native";

export default function FormRow({ children }: { children: any }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
  },
});
