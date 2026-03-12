import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../../theme/colors";

export default function DangerButton({
  title,
  onPress,
}: {
  title: string;
  onPress: any;
}) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },

  text: {
    color: "#fff",
    fontWeight: "600",
  },
});
