import { StyleSheet, TextInput } from "react-native";
import { colors } from "../../theme/colors";

export default function FormInput(props: any) {
  return <TextInput {...props} style={[styles.input, props.style]} />;
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
