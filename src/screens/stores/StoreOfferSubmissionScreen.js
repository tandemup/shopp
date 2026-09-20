import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useConvex, useMutation } from "convex/react";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { COLORS } from "@/src/constants/colors";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const EMPTY_FORM = { storeId: "", productName: "", barcode: "", offerText: "", contactName: "", contactEmail: "", notes: "" };

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  placeholderTextColor = COLORS.textSoft,
  ...props
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={placeholderTextColor}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
        {...props}
      />
    </View>
  );
}

export default function StoreOfferSubmissionScreen({ navigation, route }) {
  const submissionType = route?.params?.submissionType === "owner" ? "owner" : "shopper";
  const isOwner = submissionType === "owner";
  const convex = useConvex();
  const createSubmission = useMutation(api.storeOfferSubmissions.create);
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    convex.query(api.stores.listStores, {}).then((items) => {
      if (active) setStores(Array.isArray(items) ? items : []);
    }).catch((error) => safeAlert("Error", error?.message || "No se pudieron cargar los supermercados.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [convex]));

  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async () => {
    if (!form.storeId || !form.productName.trim() || !form.offerText.trim()) {
      safeAlert("Faltan datos", "Selecciona supermercado e indica producto y oferta.");
      return;
    }
    if (isOwner && (!form.contactName.trim() || !form.contactEmail.trim())) {
      safeAlert("Faltan datos", "El propietario debe indicar nombre y correo de contacto.");
      return;
    }
    try {
      setSubmitting(true);
      await createSubmission({
        submissionType, storeId: form.storeId, productName: form.productName.trim(), offerText: form.offerText.trim(),
        ...(form.barcode.trim() ? { barcode: form.barcode.trim() } : {}),
        ...(form.contactName.trim() ? { contactName: form.contactName.trim() } : {}),
        ...(form.contactEmail.trim() ? { contactEmail: form.contactEmail.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      setForm(EMPTY_FORM);
      safeAlert("Solicitud enviada", isOwner ? "La promoción se revisará antes de publicarse." : "Gracias. La oferta se comprobará antes de compartirse.", [{ text: "Aceptar", onPress: () => navigation.goBack() }]);
    } catch (error) {
      safeAlert("Error", error?.message || "No se pudo enviar la solicitud.");
    } finally { setSubmitting(false); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{isOwner ? "Promocionar productos" : "Comunicar una oferta"}</Text>
    <Text style={styles.subtitle}>{isOwner ? "Envía una solicitud comercial. Shopp verificará al propietario antes de publicar la promoción." : "Comparte una oferta encontrada al comprar. Se publicará después de revisarla."}</Text>
    <Text style={styles.label}>Supermercado *</Text>
    {loading ? <ActivityIndicator color="#2563EB" /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeScroller}>{stores.map((store) => <Pressable key={store.id} onPress={() => setForm((current) => ({ ...current, storeId: store.id }))} style={[styles.storeChip, form.storeId === store.id && styles.storeChipSelected]}><Text style={[styles.storeChipText, form.storeId === store.id && styles.storeChipTextSelected]}>{store.name}</Text></Pressable>)}</ScrollView>}
    <View style={styles.card}>
      <Field label="Producto *" value={form.productName} onChangeText={update("productName")} />
      <Field label="Código de barras" value={form.barcode} onChangeText={update("barcode")} keyboardType="number-pad" />
      <Field label="Descripción de la oferta *" value={form.offerText} onChangeText={update("offerText")} multiline />
      {isOwner ? <><Field label="Nombre de contacto *" value={form.contactName} onChangeText={update("contactName")} /><Field label="Correo de contacto *" value={form.contactEmail} onChangeText={update("contactEmail")} keyboardType="email-address" autoCapitalize="none" /></> : null}
      <Field label="Observaciones" value={form.notes} onChangeText={update("notes")} multiline />
      <Pressable disabled={submitting} onPress={submit} style={[styles.submit, submitting && styles.disabled]}>{submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Enviar solicitud</Text>}</Pressable>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9FAFB" }, content: { padding: 20, paddingBottom: 42 },
  title: { fontSize: 27, fontWeight: "800", color: "#111827", marginBottom: 8 }, subtitle: { color: "#6B7280", lineHeight: 21, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 }, storeScroller: { marginBottom: 16 },
  storeChip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 999, backgroundColor: "#FFFFFF", marginRight: 8 }, storeChipSelected: { backgroundColor: "#2563EB", borderColor: "#2563EB" }, storeChipText: { color: "#374151", fontWeight: "600" }, storeChipTextSelected: { color: "#FFFFFF" },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 17 }, field: { marginBottom: 15 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 11, paddingHorizontal: 13, fontSize: 16, color: "#111827" }, multiline: { minHeight: 92, paddingTop: 12, textAlignVertical: "top" },
  submit: { minHeight: 50, borderRadius: 12, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.6 }, submitText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
