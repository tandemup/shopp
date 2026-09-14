import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "convex/react";
import * as Location from "expo-location";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { buildHeaderConfig } from "@/src/utils/layout/headerStyles";

const EMPTY_FORM = {
  name: "",
  chain: "",
  address: "",
  city: "Gijón",
  provincia: "Asturias",
  zipcode: "",
  notes: "",
  lat: "",
  lng: "",
};

function FormField({ label, value, onChangeText, required, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required ? " *" : ""}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#9CA3AF"
        style={[styles.input, props.multiline && styles.notesInput]}
        {...props}
      />
    </View>
  );
}

export default function StoreCreationRequestScreen({ navigation }) {
  const createRequest = useMutation(api.storeCreationRequests.create);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const headerConfig = useMemo(
    () =>
      buildHeaderConfig({
        title: "Petición de creación de tienda",
        preset: "light",
      }),
    [],
  );

  useEffect(() => {
    navigation.setOptions(headerConfig.navigationOptions);
  }, [navigation, headerConfig]);

  const updateField = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const lat = Number(form.lat.replace(",", "."));
    const lng = Number(form.lng.replace(",", "."));
    if (!form.name.trim() || !form.address.trim() || !form.city.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      safeAlert("Faltan datos", "Nombre, dirección, ciudad y ubicación son obligatorios.");
      return;
    }

    try {
      setSubmitting(true);
      await createRequest({
        name: form.name.trim(),
        ...(form.chain.trim() ? { chain: form.chain.trim() } : {}),
        address: form.address.trim(),
        city: form.city.trim(),
        ...(form.provincia.trim()
          ? { provincia: form.provincia.trim() }
          : {}),
        ...(form.zipcode.trim() ? { zipcode: form.zipcode.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        lat,
        lng,
      });
      setForm(EMPTY_FORM);
      safeAlert(
        "Petición enviada",
        "La tienda se revisará antes de incorporarla a Shopp.",
        [{ text: "Aceptar", onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      console.warn("[StoreCreationRequestScreen] submit error", error);
      safeAlert("Error", error?.message || "No se pudo enviar la petición.");
    } finally {
      setSubmitting(false);
    }
  };

  const captureLocation = async () => {
    try {
      setLocating(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("No se concedió permiso de ubicación.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm((current) => ({
        ...current,
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude),
      }));
    } catch (error) {
      safeAlert("Ubicación", error?.message || "No se pudo obtener la ubicación.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar {...headerConfig.statusBar} />
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Proponer un supermercado</Text>
            <Text style={styles.subtitle}>
              Indica los datos de un supermercado que todavía no aparece en Shopp.
              La petición quedará pendiente de revisión.
            </Text>

            <View style={styles.card}>
              <FormField label="Nombre de la tienda" required value={form.name} onChangeText={updateField("name")} />
              <FormField label="Cadena" value={form.chain} onChangeText={updateField("chain")} />
              <FormField label="Dirección" required value={form.address} onChangeText={updateField("address")} />
              <FormField label="Ciudad" required value={form.city} onChangeText={updateField("city")} />
              <FormField label="Provincia" value={form.provincia} onChangeText={updateField("provincia")} />
              <FormField label="Código postal" value={form.zipcode} onChangeText={updateField("zipcode")} keyboardType="number-pad" maxLength={12} />
              <Pressable style={styles.locationButton} disabled={locating} onPress={captureLocation}>
                <Text style={styles.locationButtonText}>{locating ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}</Text>
              </Pressable>
              <View style={styles.coordinateRow}>
                <View style={styles.coordinateField}><FormField label="Latitud" required value={form.lat} onChangeText={updateField("lat")} keyboardType="decimal-pad" /></View>
                <View style={styles.coordinateField}><FormField label="Longitud" required value={form.lng} onChangeText={updateField("lng")} keyboardType="decimal-pad" /></View>
              </View>
              <FormField label="Observaciones" value={form.notes} onChangeText={updateField("notes")} multiline numberOfLines={4} maxLength={1000} textAlignVertical="top" />

              <Text style={styles.requiredNote}>* Campos obligatorios</Text>

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitPressed,
                  submitting && styles.submitDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>Enviar petición</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#F9FAFB" },
  safeArea: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", color: "#111827", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, color: "#6B7280", marginBottom: 22 },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 18, padding: 18 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, paddingHorizontal: 13, color: "#111827", backgroundColor: "#FFFFFF", fontSize: 16 },
  notesInput: { minHeight: 100, paddingTop: 12 },
  locationButton: { minHeight: 46, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  locationButtonText: { color: "#1D4ED8", fontWeight: "700" },
  coordinateRow: { flexDirection: "row", gap: 12 },
  coordinateField: { flex: 1 },
  requiredNote: { color: "#6B7280", fontSize: 13, marginBottom: 16 },
  submitButton: { minHeight: 50, borderRadius: 12, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" },
  submitPressed: { opacity: 0.82 },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
