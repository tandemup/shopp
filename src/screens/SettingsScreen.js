// screens/SettingsScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, Switch, StyleSheet, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "@expo-shop/search-settings";

// 🔧 Valores por defecto
const DEFAULT_SETTINGS = {
  bookEngines: {
    googleBooks: true,
    openLibrary: true,
    amazonBooks: false,
    goodreads: false,
  },
  productEngines: {
    googleShopping: true,
    amazon: false,
    openFoodFacts: true,
    idealo: false,
  },
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // 📌 Cargar preferencias al inicio
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (err) {
      console.log("❌ Error loading settings:", err);
    }
  };

  // 💾 Guardar automáticamente cada cambio
  const saveSettings = async (updated) => {
    try {
      setSettings(updated);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.log("❌ Error saving settings:", err);
    }
  };

  // 🔄 Cambiar un switch
  const toggleEngine = (category, key) => {
    const updated = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: !settings[category][key],
      },
    };
    saveSettings(updated);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Configuración</Text>

      {/* 📚 Motores para libros */}
      <Text style={styles.sectionTitle}>Motores de búsqueda para libros</Text>

      {Object.entries(settings.bookEngines).map(([key, value]) => (
        <View style={styles.row} key={key}>
          <Text style={styles.label}>{formatEngineName(key)}</Text>
          <Switch
            value={value}
            onValueChange={() => toggleEngine("bookEngines", key)}
          />
        </View>
      ))}

      {/* 🛒 Motores para productos */}
      <Text style={styles.sectionTitle}>
        Motores de búsqueda para productos
      </Text>

      {Object.entries(settings.productEngines).map(([key, value]) => (
        <View style={styles.row} key={key}>
          <Text style={styles.label}>{formatEngineName(key)}</Text>
          <Switch
            value={value}
            onValueChange={() => toggleEngine("productEngines", key)}
          />
        </View>
      ))}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

// 🏷 Formato de nombres
const formatEngineName = (key) => {
  const map = {
    googleBooks: "Google Books",
    openLibrary: "OpenLibrary",
    amazonBooks: "Amazon Books",
    goodreads: "Goodreads",
    googleShopping: "Google Shopping",
    amazon: "Amazon",
    openFoodFacts: "OpenFoodFacts",
    idealo: "Idealo",
  };
  return map[key] ?? key;
};

//
// 🎨 ESTILOS
//
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FAFAFA",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 20,
    color: "#1a237e",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  label: {
    fontSize: 16,
  },
});
