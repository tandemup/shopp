import React, { memo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

function CategoryImageSelector({
  title = "Categoría",
  categories = [],
  selectedCategoryId,
  onChange,
  showTitle = true,
}) {
  function handleSelect(category) {
    if (typeof onChange === "function") {
      onChange(category);
    }
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {showTitle ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((category) => {
          const selected = category.id === selectedCategoryId;

          return (
            <Pressable
              key={category.id}
              onPress={() => handleSelect(category)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
            >
              <View
                style={[styles.imageBox, selected && styles.imageBoxSelected]}
              >
                <Image
                  source={category.image}
                  style={styles.image}
                  resizeMode="contain"
                />

                {selected ? (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={13} color="#ffffff" />
                  </View>
                ) : null}
              </View>

              <Text
                style={[styles.label, selected && styles.labelSelected]}
                numberOfLines={2}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default memo(CategoryImageSelector);

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 12,
  },

  header: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },

  card: {
    width: 104,
    alignItems: "center",
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  cardSelected: {},

  imageBox: {
    width: 90,
    height: 90,
    borderRadius: 26,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  imageBoxSelected: {
    borderColor: "#2563eb",
    borderWidth: 2,
    backgroundColor: "#eff6ff",
  },

  image: {
    width: 78,
    height: 78,
  },

  checkBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },

  label: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600",
    color: "#6b7280",
    textAlign: "center",
  },

  labelSelected: {
    color: "#2563eb",
    fontWeight: "800",
  },
});
