
import { StyleSheet } from "react-native"
import { colors, spacing } from "./theme"

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background
  },

  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: spacing.lg
  },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 6
  },

  card: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  }
})
