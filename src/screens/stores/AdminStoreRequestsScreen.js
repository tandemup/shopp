import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

function numberOrNull(value) {
  const number = Number(String(value || "").trim().replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export default function AdminStoreRequestsScreen() {
  const currentUser = useQuery(api.users.current);
  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === "admin";
  const requests = useQuery(api.stores.listPendingStoreRequests, isAdmin ? {} : "skip");
  const approveRequest = useMutation(api.stores.approveStoreRequest);
  const rejectRequest = useMutation(api.stores.rejectStoreRequest);
  const [coordinates, setCoordinates] = useState({});
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!requests) return;
    setCoordinates((previous) => {
      const next = { ...previous };
      requests.forEach((request) => {
        if (!next[request._id]) {
          next[request._id] = {
            latitude: request.location?.lat?.toString() || "",
            longitude: request.location?.lng?.toString() || "",
          };
        }
      });
      return next;
    });
  }, [requests]);

  const updateCoordinate = (requestId, field, value) => {
    setCoordinates((previous) => ({
      ...previous,
      [requestId]: { ...previous[requestId], [field]: value },
    }));
  };

  const handleApprove = async (request) => {
    const value = coordinates[request._id] || {};
    const latitude = numberOrNull(value.latitude);
    const longitude = numberOrNull(value.longitude);

    if (latitude === null || longitude === null) {
      safeAlert("Faltan coordenadas", "Introduce una latitud y una longitud válidas antes de publicar la tienda.");
      return;
    }

    try {
      setBusyId(request._id);
      await approveRequest({ requestId: request._id, latitude, longitude });
      safeAlert("Tienda validada", "La tienda ya está publicada en el catálogo.");
    } catch (error) {
      safeAlert("No se pudo validar", error?.message || "Inténtalo de nuevo.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = (request) => {
    safeAlert("Rechazar propuesta", `¿Rechazar la propuesta de ${request.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rechazar",
        style: "destructive",
        onPress: async () => {
          try {
            setBusyId(request._id);
            await rejectRequest({ requestId: request._id });
          } catch (error) {
            safeAlert("No se pudo rechazar", error?.message || "Inténtalo de nuevo.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  if (currentUser === undefined) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={42} color="#dc2626" />
        <Text style={styles.title}>Acceso restringido</Text>
        <Text style={styles.muted}>Solo los administradores pueden validar tiendas.</Text>
      </View>
    );
  }

  if (requests === undefined) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Ionicons name="shield-checkmark-outline" size={28} color="#2563eb" />
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>ADMINISTRACIÓN</Text>
          <Text style={styles.title}>Validar tiendas</Text>
          <Text style={styles.muted}>Publica solo las propuestas verificadas.</Text>
        </View>
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-done-outline" size={34} color="#16a34a" />
          <Text style={styles.emptyTitle}>No hay propuestas pendientes</Text>
        </View>
      ) : requests.map((request) => {
        const values = coordinates[request._id] || {};
        const busy = busyId === request._id;
        return (
          <View key={request._id} style={styles.card}>
            <Text style={styles.cardTitle}>{request.name}</Text>
            <Text style={styles.details}>{request.address}</Text>
            <Text style={styles.details}>{request.city}, {request.provincia}{request.zipcode ? ` · ${request.zipcode}` : ""}</Text>

            <Text style={styles.label}>Latitud *</Text>
            <TextInput value={values.latitude} onChangeText={(value) => updateCoordinate(request._id, "latitude", value)} keyboardType="decimal-pad" placeholder="43.5350" placeholderTextColor="#94a3b8" style={styles.input} />
            <Text style={styles.label}>Longitud *</Text>
            <TextInput value={values.longitude} onChangeText={(value) => updateCoordinate(request._id, "longitude", value)} keyboardType="decimal-pad" placeholder="-5.6615" placeholderTextColor="#94a3b8" style={styles.input} />

            <View style={styles.actions}>
              <Pressable disabled={busy} onPress={() => handleReject(request)} style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}>
                <Text style={styles.rejectText}>Rechazar</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => handleApprove(request)} style={({ pressed }) => [styles.approveButton, pressed && styles.pressed]}>
                {busy ? <ActivityIndicator color="#ffffff" /> : <><Ionicons name="checkmark" size={18} color="#ffffff" /><Text style={styles.approveText}>Validar y publicar</Text></>}
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" }, container: { padding: 20, paddingBottom: 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", marginBottom: 22 }, headerText: { flex: 1, marginLeft: 12 },
  eyebrow: { fontSize: 12, color: "#2563eb", fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 23, color: "#0f172a", fontWeight: "800", marginTop: 3 }, muted: { fontSize: 14, color: "#64748b", lineHeight: 20, marginTop: 4 },
  card: { backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 5 }, details: { color: "#475569", fontSize: 14, lineHeight: 20 },
  label: { color: "#334155", fontSize: 13, fontWeight: "700", marginTop: 13, marginBottom: 5 },
  input: { minHeight: 44, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 11, color: "#0f172a", fontSize: 15 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  rejectButton: { minHeight: 46, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: "#fecaca", alignItems: "center", justifyContent: "center" },
  rejectText: { color: "#dc2626", fontWeight: "800" },
  approveButton: { flex: 1, minHeight: 46, borderRadius: 11, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  approveText: { color: "#ffffff", fontWeight: "800" }, pressed: { opacity: 0.78 },
  emptyCard: { backgroundColor: "#ffffff", borderRadius: 16, padding: 28, alignItems: "center", gap: 10 }, emptyTitle: { color: "#166534", fontWeight: "800", fontSize: 16 },
});
