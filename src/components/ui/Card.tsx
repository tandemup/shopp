import { StyleSheet, View } from "react-native";
import { colors } from "../../theme/colors";

export default function Card({ children }: { children: any }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
  },
});
