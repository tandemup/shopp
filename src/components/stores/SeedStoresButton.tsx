import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { api } from "../../../convex/_generated/api";
import { STORES_SEED } from "../../seeds/stores";

export function SeedStoresButton() {
  const seedDefaults = useMutation(api.stores.seedDefaults);
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if (loading) return;

    try {
      setLoading(true);
      await seedDefaults({ stores: STORES_SEED });
    } catch (error) {
      console.error("Failed to seed stores:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      style={[styles.button, loading && styles.buttonDisabled]}
      onPress={handleSeed}
    >
      <Text style={styles.buttonText}>
        {loading ? "Seeding stores..." : "Seed stores"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#e9e9e9",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#222",
    fontWeight: "600",
    fontSize: 16,
  },
});
