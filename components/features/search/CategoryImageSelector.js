import React, { memo, useMemo } from "react";
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
  subcategoryTitle = "Subcategoría",

  categories = [],

  selectedCategoryId,
  selectedSubcategoryId,

  onChange,
  onSubcategoryChange,

  showTitle = true,
  showSubcategories = true,
}) {
  function handleSelectCategory(category) {
    if (typeof onChange === "function") {
      onChange(category);
    }
  }

  function handleSelectSubcategory(subcategory, category) {
    if (typeof onSubcategoryChange === "function") {
      onSubcategoryChange(subcategory, category);
    }
  }

  const selectedCategory = useMemo(() => {
    if (!Array.isArray(categories)) {
      return null;
    }

    return (
      categories.find((category) => category.id === selectedCategoryId) ?? null
    );
  }, [categories, selectedCategoryId]);

  const subcategories = Array.isArray(selectedCategory?.subcategories)
    ? selectedCategory.subcategories
    : [];

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
              onPress={() => handleSelectCategory(category)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
            >
              <View
                style={[styles.imageBox, selected && styles.imageBoxSelected]}
              >
                {category.image ? (
                  <Image
                    source={category.image}
                    style={styles.image}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name="image-outline" size={34} color="#9CA3AF" />
                )}

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

      {showSubcategories && selectedCategory && subcategories.length > 0 ? (
        <View style={styles.subcategoriesContainer}>
          <View style={styles.subcategoryHeader}>
            <Text style={styles.subcategoryTitle}>{subcategoryTitle}</Text>
            <Text style={styles.selectedCategoryName} numberOfLines={1}>
              {selectedCategory.name}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subcategoriesScrollContent}
          >
            {subcategories.map((subcategory) => {
              const subcategoryId =
                typeof subcategory === "string" ? subcategory : subcategory.id;

              const subcategoryName =
                typeof subcategory === "string"
                  ? subcategory
                  : subcategory.name;

              const selected = subcategoryId === selectedSubcategoryId;

              return (
                <Pressable
                  key={subcategoryId}
                  onPress={() =>
                    handleSelectSubcategory(subcategory, selectedCategory)
                  }
                  style={({ pressed }) => [
                    styles.subcategoryChip,
                    selected && styles.subcategoryChipSelected,
                    pressed && styles.subcategoryChipPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.subcategoryChipText,
                      selected && styles.subcategoryChipTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {subcategoryName}
                  </Text>

                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color="#2563eb"
                      style={styles.subcategoryIcon}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export default memo(CategoryImageSelector);

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 16,
  },

  header: {
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  scrollContent: {
    paddingHorizontal: 0,
    paddingRight: 8,
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
  subcategoriesContainer: {
    marginTop: 14,
    marginBottom: 10,
  },

  subcategoryHeader: {
    paddingHorizontal: 0,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  subcategoriesScrollContent: {
    paddingHorizontal: 0,
    paddingRight: 8,
    gap: 8,
  },

  subcategoryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  selectedCategoryName: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },

  subcategoryChip: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  subcategoryChipSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },

  subcategoryChipPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  subcategoryChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5563",
  },

  subcategoryChipTextSelected: {
    color: "#2563eb",
  },

  subcategoryIcon: {
    marginLeft: 6,
  },
});
