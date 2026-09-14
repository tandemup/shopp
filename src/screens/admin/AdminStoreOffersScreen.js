import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useConvex, useMutation } from "convex/react";
import { I18nText as Text } from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const STATUS = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" };

export default function AdminStoreOffersScreen() {
  const convex = useConvex();
  const updateStatus = useMutation(api.storeOfferSubmissions.updateStatusForAdmin);
  const [items, setItems] = useState([]);
  const [storesById, setStoresById] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [submissions, stores] = await Promise.all([
        convex.query(api.storeOfferSubmissions.listForAdmin, {}),
        convex.query(api.stores.listStores, {}),
      ]);
      setItems(Array.isArray(submissions) ? submissions : []);
      setStoresById(Object.fromEntries((stores || []).map((store) => [store.id, store])));
    } catch (error) {
      safeAlert("Error", error?.message || "No se pudieron cargar las ofertas.");
    } finally { setLoading(false); }
  }, [convex]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeStatus = (item, status) => {
    safeAlert(status === "approved" ? "Aprobar oferta" : "Rechazar oferta", `¿Confirmas esta acción para ${item.productName}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: status === "approved" ? "Aprobar" : "Rechazar", style: status === "rejected" ? "destructive" : "default", onPress: async () => {
        try {
          setBusyId(item._id);
          await updateStatus({ submissionId: item._id, status });
          setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, status } : entry));
        } catch (error) { safeAlert("Error", error?.message || "No se pudo actualizar la oferta."); }
        finally { setBusyId(null); }
      } },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.heading}><View><Text style={styles.title}>Ofertas recibidas</Text><Text style={styles.subtitle}>{items.filter((item) => item.status === "pending").length} pendientes</Text></View><Pressable style={styles.refresh} onPress={load}><Ionicons name="refresh-outline" size={22} color="#2563EB" /></Pressable></View>
    {items.length === 0 ? <Text style={styles.empty}>No hay ofertas recibidas.</Text> : null}
    {items.map((item) => <View key={item._id} style={styles.card}>
      <View style={styles.typeRow}><Text style={styles.type}>{item.submissionType === "owner" ? "SOLICITUD COMERCIAL" : "SUGERENCIA DE COMPRADOR"}</Text><Text style={styles.status}>{STATUS[item.status]}</Text></View>
      <Text style={styles.product}>{item.productName}</Text>
      <Text style={styles.store}>{storesById[item.storeId]?.name || item.storeId}</Text>
      <Text style={styles.offer}>{item.offerText}</Text>
      {item.barcode ? <Text style={styles.meta}>Código: {item.barcode}</Text> : null}
      {item.contactName || item.contactEmail ? <Text style={styles.meta}>Contacto: {[item.contactName, item.contactEmail].filter(Boolean).join(" · ")}</Text> : null}
      {item.status === "pending" ? <View style={styles.actions}><Pressable disabled={busyId === item._id} style={[styles.button, styles.reject]} onPress={() => changeStatus(item, "rejected")}><Text style={styles.rejectText}>Rechazar</Text></Pressable><Pressable disabled={busyId === item._id} style={[styles.button, styles.approve]} onPress={() => changeStatus(item, "approved")}><Text style={styles.approveText}>Aprobar</Text></Pressable></View> : null}
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9FAFB" }, content: { padding: 20, paddingBottom: 40 }, center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }, title: { fontSize: 27, fontWeight: "800", color: "#111827" }, subtitle: { color: "#6B7280", marginTop: 4 }, refresh: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#EFF6FF", borderRadius: 14 },
  empty: { color: "#6B7280", textAlign: "center", marginTop: 40 }, card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 15, padding: 16, marginBottom: 13 },
  typeRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, type: { color: "#2563EB", fontSize: 11, fontWeight: "800" }, status: { color: "#6B7280", fontSize: 12, fontWeight: "700" }, product: { color: "#111827", fontSize: 18, fontWeight: "700", marginTop: 10 }, store: { color: "#6B7280", marginTop: 3 }, offer: { color: "#374151", backgroundColor: "#F9FAFB", padding: 11, borderRadius: 10, marginTop: 12, lineHeight: 20 }, meta: { color: "#6B7280", fontSize: 13, marginTop: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 15 }, button: { flex: 1, minHeight: 43, borderRadius: 10, justifyContent: "center", alignItems: "center" }, reject: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }, approve: { backgroundColor: "#2563EB" }, rejectText: { color: "#B91C1C", fontWeight: "700" }, approveText: { color: "#FFFFFF", fontWeight: "700" },
});
