// src/screens/stores/StoresExploreScreen.js

import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/*
  Sustituye este array por tu fichero JSON o por el contexto global
  cuando tengas conectados los datos reales de tiendas.
*/
const AVAILABLE_STORES = [
  {
    id: "mercadona-centro",
    name: "Mercadona",
    address: "Calle Uría, 14",
    city: "Oviedo",
    zipcode: "33003",
  },
  {
    id: "carrefour-los-prados",
    name: "Carrefour Los Prados",
    address: "Calle Joaquín Costa, s/n",
    city: "Oviedo",
    zipcode: "33011",
  },
  {
    id: "lidl-centro",
    name: "Lidl",
    address: "Avenida de Galicia, 28",
    city: "Oviedo",
    zipcode: "33005",
  },
  {
    id: "aldi-asturias",
    name: "Aldi",
    address: "Calle General Elorza, 63",
    city: "Oviedo",
    zipcode: "33001",
  },
  {
    id: "masymas-centro",
    name: "Masymas",
    address: "Calle Matemático Pedrayes, 5",
    city: "Oviedo",
    zipcode: "33005",
  },
];

function normalizeText(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function StoreCard({ store, isFavorite, onToggleFavorite, onSelect }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.storeCard,
        pressed && styles.storeCardPressed,
      ]}
      onPress={() => onSelect(store)}
    >
      <View style={styles.storeIconContainer}>
        <Ionicons name="storefront-outline" size={24} color="#2563eb" />
      </View>

      <View style={styles.storeContent}>
        <Text style={styles.storeName}>{store.name}</Text>

        <Text style={styles.storeAddress}>{store.address}</Text>

        <Text style={styles.storeCity}>
          {store.zipcode} · {store.city}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isFavorite
            ? `Quitar ${store.name} de favoritos`
            : `Añadir ${store.name} a favoritos`
        }
        hitSlop={12}
        style={({ pressed }) => [
          styles.favoriteButton,
          pressed && styles.favoriteButtonPressed,
        ]}
        onPress={(event) => {
          event.stopPropagation();
          onToggleFavorite(store);
        }}
      >
        <Ionicons
          name={isFavorite ? "star" : "star-outline"}
          size={24}
          color={isFavorite ? "#f59e0b" : "#94a3b8"}
        />
      </Pressable>
    </Pressable>
  );
}

export default function StoresExploreScreen({ navigation, route }) {
  const [searchText, setSearchText] = useState("");
  const [favoriteStoreIds, setFavoriteStoreIds] = useState([]);

  /*
    Estos parámetros son opcionales.

    Ejemplo:
    navigation.navigate("StoresExplore", {
      mode: "select",
      selectForListId: list.id,
    });
  */
  const mode = route?.params?.mode ?? "browse";
  const selectForListId = route?.params?.selectForListId ?? null;

  const filteredStores = useMemo(() => {
    const normalizedSearch = normalizeText(searchText);

    if (!normalizedSearch) {
      return AVAILABLE_STORES;
    }

    return AVAILABLE_STORES.filter((store) => {
      const searchableText = normalizeText(
        `${store.name} ${store.address} ${store.city} ${store.zipcode}`,
      );

      return searchableText.includes(normalizedSearch);
    });
  }, [searchText]);

  function isFavorite(storeId) {
    return favoriteStoreIds.includes(storeId);
  }

  function toggleFavorite(store) {
    setFavoriteStoreIds((currentIds) => {
      const alreadyFavorite = currentIds.includes(store.id);

      if (alreadyFavorite) {
        return currentIds.filter((id) => id !== store.id);
      }

      return [...currentIds, store.id];
    });
  }

  function selectStore(store) {
    if (mode !== "select") {
      Alert.alert(
        store.name,
        `${store.address}\n${store.zipcode} ${store.city}`,
      );

      return;
    }

    /*
      En esta primera versión devolvemos la tienda seleccionada
      a la pantalla anterior usando merge.

      La pantalla anterior podrá leer:
      route.params.selectedStore
    */
    navigation.navigate({
      name: route?.params?.returnScreenName ?? "StoresFavorites",
      params: {
        selectedStore: store,
        selectForListId,
      },
      merge: true,
    });
  }

  function goToFavorites() {
    /*
      Al navegar dentro del mismo Stack puedes usar directamente
      navigation.navigate("StoresFavorites").
    */
    navigation.navigate("StoresFavorites");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Explorar tiendas</Text>

        <Text style={styles.subtitle}>
          Busca supermercados y marca tus establecimientos favoritos.
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#64748b" />

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          style={styles.searchInput}
          placeholder="Buscar una tienda"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {searchText.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar búsqueda"
            hitSlop={10}
            onPress={() => setSearchText("")}
          >
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {filteredStores.length === 1
            ? "1 tienda encontrada"
            : `${filteredStores.length} tiendas encontradas`}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.favoritesLink,
            pressed && styles.favoritesLinkPressed,
          ]}
          onPress={goToFavorites}
        >
          <Ionicons name="star-outline" size={17} color="#2563eb" />

          <Text style={styles.favoritesLinkText}>Favoritas</Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredStores}
        keyExtractor={(store) => store.id}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            isFavorite={isFavorite(item.id)}
            onToggleFavorite={toggleFavorite}
            onSelect={selectStore}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          filteredStores.length === 0 && styles.emptyListContent,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="search-outline" size={34} color="#94a3b8" />
            </View>

            <Text style={styles.emptyTitle}>No encontramos tiendas</Text>

            <Text style={styles.emptyText}>
              Prueba a introducir otro nombre, dirección o localidad.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
  },

  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
  },

  subtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
  },

  searchContainer: {
    minHeight: 48,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },

  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: "#0f172a",
    fontSize: 15,
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },

  favoritesLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  favoritesLinkPressed: {
    opacity: 0.65,
  },

  favoritesLinkText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },

  storeCard: {
    minHeight: 86,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },

  storeCardPressed: {
    opacity: 0.76,
  },

  storeIconContainer: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#eff6ff",
  },

  storeContent: {
    flex: 1,
  },

  storeName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },

  storeAddress: {
    marginTop: 4,
    color: "#475569",
    fontSize: 13,
  },

  storeCity: {
    marginTop: 3,
    color: "#94a3b8",
    fontSize: 12,
  },

  favoriteButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },

  favoriteButtonPressed: {
    backgroundColor: "#f8fafc",
  },

  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  emptyContainer: {
    paddingHorizontal: 28,
    alignItems: "center",
  },

  emptyIconContainer: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
  },

  emptyTitle: {
    marginTop: 16,
    color: "#334155",
    fontSize: 16,
    fontWeight: "800",
  },

  emptyText: {
    marginTop: 7,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
