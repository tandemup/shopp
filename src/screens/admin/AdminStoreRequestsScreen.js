import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useConvex, useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const STATUS_LABELS = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

function RequestCard({ item, busy, onUpdateStatus, onSaveLocation }) {
  const [lat, setLat] = useState(item.lat == null ? "" : String(item.lat));
  const [lng, setLng] = useState(item.lng == null ? "" : String(item.lng));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.storeIcon}>
          <Ionicons name="storefront-outline" size={24} color="#1D4ED8" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.storeName}>{item.name}</Text>
          <Text style={[styles.status, styles[`status_${item.status}`]]}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.address}>{item.address}</Text>
      <Text style={styles.location}>
        {[item.zipcode, item.city, item.provincia].filter(Boolean).join(" · ")}
      </Text>
      {item.chain ? <Text style={styles.meta}>Cadena: {item.chain}</Text> : null}
      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
      <Text style={styles.meta}>
        Enviada: {new Date(item.createdAt).toLocaleString("es-ES")}
      </Text>

      {item.status === "pending" ? (
        <>
          <View style={styles.coordinateRow}>
            <TextInput value={lat} onChangeText={setLat} placeholder="Latitud" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" style={styles.coordinateInput} />
            <TextInput value={lng} onChangeText={setLng} placeholder="Longitud" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" style={styles.coordinateInput} />
            <Pressable style={styles.saveLocation} onPress={() => onSaveLocation(item, lat, lng)}><Ionicons name="save-outline" size={20} color="#1D4ED8" /></Pressable>
          </View>
          <View style={styles.actions}>
          <Pressable
            disabled={busy}
            style={[styles.button, styles.rejectButton]}
            onPress={() => onUpdateStatus(item, "rejected")}
          >
            <Text style={styles.rejectText}>Rechazar</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            style={[styles.button, styles.approveButton]}
            onPress={() => onUpdateStatus(item, "approved")}
          >
            <Text style={styles.approveText}>Aprobar</Text>
          </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function AdminStoreRequestsScreen() {
  const convex = useConvex();
  const updateStatus = useMutation(
    api.storeCreationRequests.updateStatusForAdmin,
  );
  const updateLocation = useMutation(
    api.storeCreationRequests.updateLocationForAdmin,
  );
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const loadRequests = useCallback(
    async ({ refresh = false } = {}) => {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const result = await convex.query(
          api.storeCreationRequests.listForAdmin,
          {},
        );
        setRequests(Array.isArray(result) ? result : []);
      } catch (loadError) {
        console.warn("[AdminStoreRequestsScreen] load error", loadError);
        setError(loadError?.message || "No se pudieron cargar las peticiones.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [convex],
  );

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === "pending").length,
    [requests],
  );

  const changeStatus = (item, status) => {
    const action = status === "approved" ? "aprobar" : "rechazar";
    safeAlert(
      status === "approved" ? "Aprobar petición" : "Rechazar petición",
      `¿Quieres ${action} la petición de ${item.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: status === "approved" ? "Aprobar" : "Rechazar",
          style: status === "rejected" ? "destructive" : "default",
          onPress: async () => {
            try {
              setBusyId(item._id);
              await updateStatus({ requestId: item._id, status });
              setRequests((current) =>
                current.map((request) =>
                  request._id === item._id
                    ? { ...request, status, updatedAt: Date.now() }
                    : request,
                ),
              );
            } catch (updateError) {
              safeAlert(
                "Error",
                updateError?.message || "No se pudo actualizar la petición.",
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const saveLocation = async (item, latText, lngText) => {
    const lat = Number(String(latText).replace(",", "."));
    const lng = Number(String(lngText).replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      safeAlert("Coordenadas", "Introduce una latitud y longitud válidas.");
      return;
    }
    try {
      setBusyId(item._id);
      await updateLocation({ requestId: item._id, lat, lng });
      setRequests((current) => current.map((request) => request._id === item._id ? { ...request, lat, lng } : request));
      safeAlert("Ubicación guardada", "Ya puedes aprobar y crear el supermercado.");
    } catch (error) {
      safeAlert("Error", error?.message || "No se pudo guardar la ubicación.");
    } finally { setBusyId(null); }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Cargando peticiones…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadRequests({ refresh: true })}
        />
      }
    >
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.title}>Peticiones de tiendas</Text>
          <Text style={styles.subtitle}>{pendingCount} pendientes</Text>
        </View>
        <Pressable
          accessibilityLabel="Actualizar peticiones"
          style={styles.refreshButton}
          onPress={() => loadRequests({ refresh: true })}
        >
          <Ionicons name="refresh-outline" size={22} color="#2563EB" />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && requests.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="storefront-outline" size={38} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No hay peticiones</Text>
        </View>
      ) : null}

      {requests.map((item) => (
        <RequestCard
          key={item._id}
          item={item}
          busy={busyId === item._id}
          onUpdateStatus={changeStatus}
          onSaveLocation={saveLocation}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB" },
  loadingText: { marginTop: 12, color: "#6B7280" },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 27, fontWeight: "800", color: "#111827" },
  subtitle: { marginTop: 4, color: "#6B7280" },
  refreshButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  storeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginRight: 12 },
  headerText: { flex: 1 },
  storeName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  status: { alignSelf: "flex-start", marginTop: 4, fontSize: 12, fontWeight: "700" },
  status_pending: { color: "#B45309" },
  status_approved: { color: "#047857" },
  status_rejected: { color: "#B91C1C" },
  address: { color: "#374151", fontSize: 15 },
  location: { color: "#6B7280", marginTop: 3 },
  notes: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: "#F9FAFB", color: "#374151", lineHeight: 20 },
  meta: { marginTop: 12, color: "#9CA3AF", fontSize: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  coordinateRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  coordinateInput: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 9, paddingHorizontal: 9, color: "#111827" },
  saveLocation: { width: 42, minHeight: 42, borderRadius: 9, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  button: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rejectButton: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  approveButton: { backgroundColor: "#2563EB" },
  rejectText: { color: "#B91C1C", fontWeight: "700" },
  approveText: { color: "#FFFFFF", fontWeight: "700" },
  error: { color: "#B91C1C", backgroundColor: "#FEF2F2", padding: 14, borderRadius: 12 },
  empty: { alignItems: "center", paddingVertical: 54 },
  emptyTitle: { marginTop: 10, color: "#6B7280", fontWeight: "700" },
});
