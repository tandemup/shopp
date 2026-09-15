import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const EMPTY_FORM = {
  name: "",
  address: "",
  city: "Gijón",
  provincia: "Asturias",
  zipcode: "",
  latitude: "",
  longitude: "",
};

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function numberOrUndefined(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export default function StoreCreationRequestScreen({ navigation }) {
  const submitStoreRequest = useMutation(api.stores.submitStoreRequest);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => form.name.trim().length > 1 && form.address.trim().length > 3,
    [form.name, form.address],
  );

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async () => {
    const latitude = numberOrUndefined(form.latitude);
    const longitude = numberOrUndefined(form.longitude);
    const zipcode = numberOrUndefined(form.zipcode);

    if (!canSubmit) {
      safeAlert("Faltan datos", "Indica el nombre y la dirección de la tienda.");
      return;
    }

    if (latitude === null || longitude === null || zipcode === null) {
      safeAlert("Datos no válidos", "Las coordenadas y el código postal deben ser números.");
      return;
    }

    if ((latitude === undefined) !== (longitude === undefined)) {
      safeAlert(
        "Coordenadas incompletas",
        "Indica latitud y longitud, o deja ambos campos vacíos.",
      );
      return;
    }

    try {
      setSubmitting(true);
      await submitStoreRequest({
        name: form.name,
        address: form.address,
        city: form.city,
        provincia: form.provincia,
        ...(zipcode === undefined ? {} : { zipcode }),
        ...(latitude === undefined ? {} : { latitude, longitude }),
      });

      safeAlert(
        "Tienda enviada",
        "La propuesta queda pendiente de validación por un administrador. No se publicará hasta ser aprobada.",
        [{ text: "Aceptar", onPress: () => navigation.goBack() }],
      );
      setForm(EMPTY_FORM);
    } catch (error) {
      safeAlert("No se pudo enviar", error?.message || "Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.infoCard}>
        <Ionicons name="storefront-outline" size={28} color="#2563eb" />
        <View style={styles.infoBody}>
          <Text style={styles.infoTitle}>Proponer una tienda</Text>
          <Text style={styles.infoText}>
            Tu propuesta será revisada antes de aparecer para el resto de usuarios.
          </Text>
        </View>
      </View>

      <Field
        label="Nombre de la tienda *"
        value={form.name}
        onChangeText={(value) => updateField("name", value)}
        placeholder="Ej. Alimerka"
      />
      <Field
        label="Dirección *"
        value={form.address}
        onChangeText={(value) => updateField("address", value)}
        placeholder="Calle y número"
      />
      <Field
        label="Ciudad"
        value={form.city}
        onChangeText={(value) => updateField("city", value)}
      />
      <Field
        label="Provincia"
        value={form.provincia}
        onChangeText={(value) => updateField("provincia", value)}
      />
      <Field
        label="Código postal"
        value={form.zipcode}
        onChangeText={(value) => updateField("zipcode", value)}
        keyboardType="numeric"
      />

      <Text style={styles.coordinatesTitle}>Coordenadas (opcionales)</Text>
      <Text style={styles.coordinatesHint}>
        Si no las conoces, el administrador podrá completarlas al validar la tienda.
      </Text>
      <Field
        label="Latitud"
        value={form.latitude}
        onChangeText={(value) => updateField("latitude", value)}
        placeholder="43.5350"
        keyboardType="decimal-pad"
      />
      <Field
        label="Longitud"
        value={form.longitude}
        onChangeText={(value) => updateField("longitude", value)}
        placeholder="-5.6615"
        keyboardType="decimal-pad"
      />

      <Pressable
        accessibilityRole="button"
        disabled={submitting}
        onPress={handleSubmit}
        style={({ pressed }) => [
          styles.submitButton,
          (!canSubmit || submitting) && styles.submitButtonDisabled,
          pressed && !submitting && styles.buttonPressed,
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Ionicons name="send-outline" size={19} color="#ffffff" />
            <Text style={styles.submitText}>Enviar para validación</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20, paddingBottom: 120 },
  infoCard: {
    flexDirection: "row", backgroundColor: "#eff6ff", borderWidth: 1,
    borderColor: "#bfdbfe", borderRadius: 16, padding: 16, marginBottom: 24,
  },
  infoBody: { flex: 1, marginLeft: 12 },
  infoTitle: { fontSize: 17, fontWeight: "800", color: "#1e3a8a", marginBottom: 4 },
  infoText: { fontSize: 14, lineHeight: 20, color: "#334155" },
  field: { marginBottom: 14 },
  label: { color: "#334155", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12,
    paddingHorizontal: 13, fontSize: 16, color: "#0f172a", backgroundColor: "#ffffff",
  },
  coordinatesTitle: { color: "#0f172a", fontSize: 16, fontWeight: "800", marginTop: 8 },
  coordinatesHint: { color: "#64748b", fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 14 },
  submitButton: {
    minHeight: 52, borderRadius: 13, backgroundColor: "#2563eb", alignItems: "center",
    justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 12,
  },
  submitButtonDisabled: { backgroundColor: "#93c5fd" },
  submitText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  buttonPressed: { opacity: 0.82 },
});
