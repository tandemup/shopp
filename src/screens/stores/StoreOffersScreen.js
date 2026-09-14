import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useConvex } from "convex/react";
import { I18nText as Text } from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/convex/_generated/api";

export default function StoreOffersScreen() {
  const convex = useConvex();
  const [offers, setOffers] = useState([]);
  const [storesById, setStoresById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [approvedOffers, stores] = await Promise.all([
        convex.query(api.storeOfferSubmissions.listApproved, { limit: 100 }),
        convex.query(api.stores.listStores, {}),
      ]);
      setOffers(Array.isArray(approvedOffers) ? approvedOffers : []);
      setStoresById(Object.fromEntries((stores || []).map((store) => [store.id, store])));
    } catch (loadError) {
      setError(loadError?.message || "No se pudieron cargar las ofertas.");
    } finally { setLoading(false); }
  }, [convex]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.heading}><View><Text style={styles.title}>Ofertas</Text><Text style={styles.subtitle}>Promociones revisadas por Shopp</Text></View><Pressable style={styles.refresh} onPress={load}><Ionicons name="refresh-outline" size={22} color="#2563EB" /></Pressable></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!error && offers.length === 0 ? <View style={styles.empty}><Ionicons name="pricetags-outline" size={40} color="#9CA3AF" /><Text style={styles.emptyText}>Todavía no hay ofertas aprobadas.</Text></View> : null}
    {offers.map((offer) => {
      const store = storesById[offer.storeId];
      return <View key={offer._id} style={styles.card}>
        <View style={styles.badge}><Text style={styles.badgeText}>{offer.submissionType === "owner" ? "OFERTA OFICIAL" : "COMUNICADA POR UN USUARIO"}</Text></View>
        <Text style={styles.product}>{offer.productName}</Text>
        <Text style={styles.store}>{store?.name || "Supermercado"}{store?.address ? ` · ${store.address}` : ""}</Text>
        <Text style={styles.offerText}>{offer.offerText}</Text>
        {offer.barcode ? <Text style={styles.meta}>Código: {offer.barcode}</Text> : null}
      </View>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9FAFB" }, content: { padding: 20, paddingBottom: 42 }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }, title: { fontSize: 28, fontWeight: "800", color: "#111827" }, subtitle: { color: "#6B7280", marginTop: 4 }, refresh: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, marginBottom: 13 }, badge: { alignSelf: "flex-start", backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, badgeText: { color: "#047857", fontSize: 10, fontWeight: "800" }, product: { fontSize: 19, fontWeight: "800", color: "#111827", marginTop: 11 }, store: { color: "#6B7280", marginTop: 4 }, offerText: { color: "#1D4ED8", fontSize: 17, fontWeight: "700", marginTop: 13 }, meta: { color: "#9CA3AF", fontSize: 12, marginTop: 10 },
  empty: { alignItems: "center", paddingTop: 55 }, emptyText: { color: "#6B7280", marginTop: 10 }, error: { color: "#B91C1C", backgroundColor: "#FEF2F2", padding: 14, borderRadius: 12 },
});
