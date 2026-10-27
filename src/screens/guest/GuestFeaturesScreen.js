import React from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Solo habilitar aquí funciones que ya disponen de una ruta guest segura en MainTabs.
const ITEMS = [
  { id: "musica", label: "Music Playlist", detail: "Playlists locales y reproducción", icon: "musical-notes-outline", available: true },
  { id: "compras", label: "Listas de la compra", detail: "Listas y productos locales", icon: "cart-outline", available: true },
  { id: "alimentos", label: "Recetas", detail: "Recetas saludables", icon: "restaurant-outline", available: true },
  { id: "clasica", label: "Música clásica", detail: "Requiere una ruta independiente para invitados", icon: "disc-outline", available: false },
  { id: "scanner", label: "Escáner QR", detail: "Pendiente de revisar cámara y rutas públicas", icon: "scan-outline", available: false },
  { id: "tiendas", label: "Tiendas", detail: "Pendiente de adaptar datos y permisos", icon: "storefront-outline", available: false },
  { id: "biblioteca", label: "Biblioteca de enlaces", detail: "Pendiente de adaptación al acceso invitado", icon: "library-outline", available: false },
  { id: "ingles", label: "Tutor de Inglés", detail: "Pendiente de adaptación al acceso invitado", icon: "school-outline", available: false },
  { id: "chat", label: "Chat", detail: "Requiere identidad y autorización específicas", icon: "chatbubbles-outline", available: false },
  { id: "p2p", label: "Intercambio P2P", detail: "Requiere autorización explícita entre usuarios", icon: "swap-horizontal-outline", available: false },
  { id: "admin", label: "Administración", detail: "Exclusiva de administradores", icon: "shield-checkmark-outline", available: false },
];

export default function GuestFeaturesScreen({ value = {}, onChange = () => {}, saving = false }) {
  const toggle = (id) => {
    if (saving) return;
    const next = { compras: !!value.compras, alimentos: !!value.alimentos, musica: !!value.musica, [id]: !value[id] };
    onChange(next);
  };
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Permisos de Invitado</Text>
      <Text style={styles.intro}>El administrador determina qué funciones puede utilizar una persona sin iniciar sesión.</Text>
      <View style={styles.notice}>
        <Ionicons name="cloud-done-outline" size={20} color="#1d4ed8" />
        <Text style={styles.noticeText}>Configuración compartida mediante Convex. Los cambios se aplican a todos los dispositivos conectados.</Text>
      </View>
      <Text style={styles.section}>FUNCIONES CONFIGURABLES</Text>
      {ITEMS.filter(x => x.available).map(item => (
        <Pressable key={item.id} accessibilityRole="checkbox"
          accessibilityLabel={item.label}
          accessibilityState={{ checked: !!value[item.id], disabled: saving }}
          disabled={saving} onPress={() => toggle(item.id)}
          style={styles.card}>
          <View style={styles.icon}><Ionicons name={item.icon} size={23} color="#2563eb" /></View>
          <View style={styles.info}><Text style={styles.name}>{item.label}</Text><Text style={styles.detail}>{item.detail}</Text></View>
          <Ionicons name={value[item.id] ? "checkbox" : "square-outline"} size={29} color="#2563eb" />
        </Pressable>
      ))}
      {saving && <View style={styles.saving}><ActivityIndicator size="small"/><Text style={styles.detail}>Guardando cambios…</Text></View>}
      <Text style={styles.section}>PENDIENTES DE ADAPTACIÓN</Text>
      <Text style={styles.explanation}>Estas funciones se muestran para documentar el catálogo. No pueden activarse hasta incorporar navegación y autorización seguras para invitados.</Text>
      {ITEMS.filter(x => !x.available).map(item => (
        <View key={item.id} style={[styles.card, styles.disabled]}>
          <View style={styles.icon}><Ionicons name={item.icon} size={23} color="#64748b" /></View>
          <View style={styles.info}><Text style={styles.name}>{item.label}</Text><Text style={styles.detail}>{item.detail}</Text></View>
          <Text style={styles.soon}>Pendiente</Text>
        </View>
      ))}
      <Text style={styles.note}>Los permisos de Invitado no modifican los de usuarios registrados. La reproducción de tarjetas QR públicas se gestiona por separado. Ocultar pestañas no sustituye los controles de autorización en Convex.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#f8fafc", padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, color: "#0f172a", fontWeight: "800", marginBottom: 10 },
  intro: { fontSize: 15, lineHeight: 22, color: "#475569", marginBottom: 15 },
  notice: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 12, backgroundColor: "#eff6ff", marginBottom: 14 },
  noticeText: { color: "#1e40af", fontSize: 13, flex: 1, lineHeight: 19 },
  section: { marginTop: 15, marginBottom: 10, fontSize: 12, fontWeight: "800", letterSpacing: 0.6, color: "#64748b" },
  explanation: { fontSize: 13, lineHeight: 19, color: "#64748b", marginBottom: 10 },
  card: { backgroundColor: "white", padding: 13, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, flexDirection: "row", alignItems: "center", marginBottom: 10 },
  disabled: { backgroundColor: "#f8fafc" },
  icon: { width: 43, height: 43, borderRadius: 12, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center", marginRight: 12 },
  info: { flex: 1, paddingRight: 8 },
  name: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 3 },
  detail: { color: "#64748b", fontSize: 12.5 },
  soon: { fontSize: 11, color: "#64748b" },
  saving: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 7 },
  note: { marginTop: 17, fontSize: 13, color: "#64748b", lineHeight: 20 },
});
