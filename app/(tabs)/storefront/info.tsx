import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useLists } from "@/src/context/ListsContext";
import { useStores } from "@/src/context/StoresContext";

import StoreMapPreview from "@/src/components/stores/StoreMapPreview";
import { getValidCoords } from "@/src/utils/maps/getValidCoords";
import {
  openGoogleMaps,
  openGoogleMapsSearch,
} from "@/src/utils/maps/openGoogleMaps";

export default function StoreDetailScreen() {
  /* ---------------------------------------------
     Params seguros (expo-router)
  ---------------------------------------------- */
  const params = useLocalSearchParams();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const selectForListId = Array.isArray(params.selectForListId)
    ? params.selectForListId[0]
    : params.selectForListId;

  const router = useRouter();

  /* ---------------------------------------------
     Contexts
  ---------------------------------------------- */
  const { getStoreById, toggleFavorite, isFavorite } = useStores();
  const { assignStoreToList } = useLists();

  /* ---------------------------------------------
     Data
  ---------------------------------------------- */
  const store = getStoreById(id as string);

  const coords = useMemo(() => (store ? getValidCoords(store) : null), [store]);

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

      // 👇 IMPORTANTE: volver correctamente a la lista
      router.replace(`/list/${selectForListId}`);
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

    const query = [store.name, store.address, store.city, store.zipcode]
      .filter(Boolean)
      .join(" ");

    if (query) openGoogleMapsSearch(query);
  };

  /* ---------------------------------------------
     Render
  ---------------------------------------------- */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* HEADER */}
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

      {/* DIRECCIÓN */}
      {store.address && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dirección</Text>
          <Text style={styles.sectionText}>
            📍 {store.address}
            {store.city ? `, ${store.city}` : ""}
          </Text>
        </View>
      )}

      {/* MAPA */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Ubicación</Text>

        {coords ? (
          <View style={styles.mapContainer}>
            <StoreMapPreview lat={coords.lat} lng={coords.lng} />
          </View>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={36} color="#999" />
            <Text style={styles.mapPlaceholderText}>
              Ubicación no disponible
            </Text>
          </View>
        )}
        <Pressable style={styles.osmButton} onPress={openInGoogleMaps}>
          <Ionicons name="map-outline" size={18} color="#1a73e8" />
          <Text style={styles.osmButtonText}>Ver mapa (OpenStreetMap)</Text>
        </Pressable>

        <Pressable style={styles.mapsButton} onPress={openInGoogleMaps}>
          <Ionicons name="navigate-outline" size={18} color="#fff" />
          <Text style={styles.mapsButtonText}>Abrir en Google Maps</Text>
        </Pressable>
      </View>

      {/* CTA SELECT */}
      {mode === "select" && (
        <Pressable style={styles.selectButton} onPress={handleSelectStore}>
          <Text style={styles.selectButtonText}>Seleccionar esta tienda</Text>
        </Pressable>
      )}

      {/* FUTURO */}
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
    paddingTop: 20,
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

  selectButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },

  selectButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  sectionMuted: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#fafafa",
    borderRadius: 8,
  },

  mutedText: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
  },

  osmButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#1a73e8",
    marginBottom: 10,
  },

  osmButtonText: {
    marginLeft: 8,
    color: "#1a73e8",
    fontSize: 14,
    fontWeight: "600",
  },
});
