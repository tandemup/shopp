import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";

import { useStores } from "../context/StoresContext";
import { getValidCoords } from "../utils/maps/getValidCoords";
import {
  openGoogleMaps,
  openGoogleMapsSearch,
} from "../utils/maps/openGoogleMaps";

import StoreMapPreview from "../components/StoreMapPreview";

export default function StoreDetailScreen() {
  const route = useRoute();
  const { storeId } = route.params || {};

  const { getStoreById, toggleFavoriteStore, isFavoriteStore } = useStores();
  const [showMapPreview, setShowMapPreview] = useState(false);

  const store = getStoreById(storeId);

  if (!store) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Tienda no encontrada</Text>
      </View>
    );
  }

  const isFavorite = isFavoriteStore(store.id);

  /* ---------------------------------------------
     Actions
  ---------------------------------------------- */
  const handleToggleFavorite = () => {
    toggleFavoriteStore(store.id);
  };

  const openInGoogleMaps = () => {
    const coords = getValidCoords(store);

    if (coords) {
      openGoogleMaps({
        lat: coords.lat,
        lng: coords.lng,
        label: store.name,
      });
      return;
    }

    const query = [store.name, store.address, store.city]
      .filter(Boolean)
      .join(" ");

    if (query) {
      openGoogleMapsSearch(query);
    }
  };

  /* ---------------------------------------------
     Internal component
  ---------------------------------------------- */
  const LocationSection = () => {
    const coords = getValidCoords(store);
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Ubicación</Text>

        {coords && showMapPreview ? (
          <View style={styles.mapContainer}>
            <StoreMapPreview lat={coords.lat} lng={coords.lng} />
          </View>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={36} color="#999" />
            <Text style={styles.mapPlaceholderText}>
              {coords ? "Previsualización del mapa" : "Ubicación no disponible"}
            </Text>
          </View>
        )}

        {coords && !showMapPreview && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setShowMapPreview(true)}
          >
            <Ionicons name="map-outline" size={18} color="#1a73e8" />
            <Text style={styles.secondaryButtonText}>
              Ver mapa (OpenStreetMap)
            </Text>
          </Pressable>
        )}

        {coords && showMapPreview && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setShowMapPreview(false)}
          >
            <Ionicons name="close-outline" size={18} color="#1a73e8" />
            <Text style={styles.secondaryButtonText}>Ocultar mapa</Text>
          </Pressable>
        )}

        <Pressable style={styles.mapsButton} onPress={openInGoogleMaps}>
          <Ionicons name="navigate-outline" size={18} color="#fff" />
          <Text style={styles.mapsButtonText}>Abrir en Google Maps</Text>
        </Pressable>
      </View>
    );
  };

  /* ---------------------------------------------
     Render
  ---------------------------------------------- */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name}>{store.name}</Text>

        <Pressable onPress={handleToggleFavorite} hitSlop={10}>
          <Ionicons
            name={isFavorite ? "star" : "star-outline"}
            size={26}
            color={isFavorite ? "#f5c518" : "#bbb"}
          />
        </Pressable>
      </View>

      {/* Address */}
      {store.address && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dirección</Text>
          <Text style={styles.sectionText}>
            📍 {store.address}
            {store.city ? `, ${store.city}` : ""}
          </Text>
        </View>
      )}

      {/* Location */}
      <LocationSection />

      {/* Future sections */}
      <View style={styles.sectionMuted}>
        <Text style={styles.mutedText}>
          Próximamente: horarios, notas y productos asociados
        </Text>
      </View>
    </ScrollView>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  errorText: {
    fontSize: 15,
    color: "#666",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  name: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    marginRight: 12,
  },

  section: {
    marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
  },

  sectionText: {
    fontSize: 15,
    color: "#111",
  },

  mapContainer: {
    height: 180,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 12,
  },

  mapPlaceholder: {
    height: 180,
    borderRadius: 10,
    backgroundColor: "#f2f2f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  mapPlaceholderText: {
    marginTop: 8,
    fontSize: 13,
    color: "#777",
  },

  secondaryButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1a73e8",
    marginBottom: 10,
  },

  secondaryButtonText: {
    marginLeft: 8,
    color: "#1a73e8",
    fontSize: 14,
    fontWeight: "600",
  },

  mapsButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a73e8",
    paddingVertical: 12,
    borderRadius: 8,
  },

  mapsButtonText: {
    marginLeft: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  sectionMuted: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#fafafa",
    borderRadius: 8,
  },

  mutedText: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
  },
});
