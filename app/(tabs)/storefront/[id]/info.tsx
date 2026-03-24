import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useStores } from "@/src/context/StoresContext";
import { useLists } from "@/src/context/ListsContext";

import { getValidCoords } from "@/src/utils/maps/getValidCoords";
import {
  openGoogleMaps,
  openGoogleMapsSearch,
} from "@/src/utils/maps/openGoogleMaps";

import StoreMapPreview from "@/src/components/StoreMapPreview";

export default function StoreDetailScreen() {
  /* ---------------------------------------------
     Router params (expo-router)
  ---------------------------------------------- */
  const { id, mode, selectForListId } = useLocalSearchParams();
  const router = useRouter();

  /* ---------------------------------------------
     Contexts
  ---------------------------------------------- */
  const { getStoreById, toggleFavorite, isFavorite } = useStores();
  const { assignStoreToList } = useLists();

  /* ---------------------------------------------
     State
  ---------------------------------------------- */
  const store = getStoreById(id as string);
  const coords = useMemo(() => getValidCoords(store), [store]);
  const [showMapPreview, setShowMapPreview] = useState(!!coords);

  if (!store) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Tienda no encontrada</Text>
      </View>
    );
  }

  const isFav = isFavorite(store.id);

  /* ---------------------------------------------
     Actions
  ---------------------------------------------- */
  const handleToggleFavorite = () => {
    toggleFavorite(store.id);
  };

  const handleSelectStore = () => {
    if (mode === "select" && selectForListId) {
      assignStoreToList(selectForListId as string, store.id);
      router.back(); // 🔥 vuelve a list/[id]
    }
  };

  const openInGoogleMaps = () => {
    if (coords) {
      openGoogleMaps({
        lat: coords.lat,
        lng: coords.lng,
        label: store.name,
      });
      return;
    }

    const query = [
      store.name,
      store.address,
      store.city,
      store.zipcode,
    ]
      .filter(Boolean)
      .join(" ");

    if (query) {
      openGoogleMapsSearch(query);
    }
  };

  /* ---------------------------------------------
     Render
  ---------------------------------------------- */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>
          {store.name}
        </Text>

        <Pressable onPress={handleToggleFavorite} hitSlop={10}>
          <Ionicons
            name={isFav ? "star" : "star-outline"}
            size={26}
            color={isFav ? "#f5c518" : "#bbb"}
          />
        </Pressable>
      </View>

      {/* ✅ BOTÓN SOLO EN MODO SELECT */}
      {mode === "select" && (
        <Pressable style={styles.selectButton} onPress={handleSelectStore}>
          <Text style={styles.selectButtonText}>
            Seleccionar esta tienda
          </Text>
        </Pressable>
      )}

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
              {coords
                ? "Previsualización del mapa"
                : "Ubicación no disponible"}
            </Text>
          </View>
        )}

        {coords && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setShowMapPreview(!showMapPreview)}
          >
            <Ionicons
              name={showMapPreview ? "close-outline" : "map-outline"}
              size={18}
              color="#1a73e8"
            />
            <Text style={styles.secondaryButtonText}>
              {showMapPreview ? "Ocultar mapa" : "Ver mapa"}
            </Text>
          </Pressable>
        )}

        <Pressable style={styles.mapsButton} onPress={openInGoogleMaps}>
          <Ionicons name="navigate-outline" size={18} color="#fff" />
          <Text style={styles.mapsButtonText}>
            Abrir en Google Maps
          </Text>
        </Pressable>
      </View>

      {/* Future */}
      <View style={styles.sectionMuted}>
        <Text style={styles.mutedText}>
          Próximamente: horarios, notas y productos asociados