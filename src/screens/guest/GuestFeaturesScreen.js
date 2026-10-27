import React from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ITEMS = [
  { id: "compras", label: "Listas de la compra", detail: "Listas, productos y compras", icon: "cart-outline", available: true },
  { id: "alimentos", label: "Alimentos / Recetas", detail: "Recetas saludables", icon: "restaurant-outline", available: true },
  { id: "biblioteca", label: "Biblioteca de enlaces", detail: "Pendiente de adaptación al acceso invitado", icon: "library-outline", available: false },
  { id: "ingles", label: "Tutor de Inglés", detail: "Pendiente de adaptación al acceso invitado", icon: "school-outline", available: false },
  { id: "musica", label: "Music Playlist", detail: "Playlists y letras guardadas en este dispositivo", icon: "musical-notes-outline", available: true },
];

export default function GuestFeaturesScreen({ value, onChange, saving = false }) {
  const toggle = (id) => {
    const next = { ...value, [id]: !value[id] };
    if (!["compras", "alimentos", "musica"].some(key => next[key])) return;
    onChange(next);
  };
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Funcionalidades del invitado</Text>
      <Text style={styles.intro}>Configura las herramientas visibles en el modo invitado de todos los dispositivos. Los datos no se borrarán al ocultar una herramienta.</Text>
      {ITEMS.map(item => (
        <Pressable
          key={item.id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!value[item.id], disabled: !item.available }}
          disabled={!item.available || saving}
          onPress={() => toggle(item.id)}
          style={[styles.card, !item.available && styles.disabled]}
        >
          <View style={styles.icon}><Ionicons name={item.icon} size={24} color="#2563eb" /></View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.label}</Text>
            <Text style={styles.detail}>{item.detail}</Text>
          </View>
          {item.available ? <Ionicons name={value[item.id] ? "checkbox" : "square-outline"} size={27} color="#2563eb" /> : <Text style={styles.soon}>Próximamente</Text>}
        </Pressable>
      ))}
      <Text style={styles.note}>La configuración se guarda en Convex y se aplica a los invitados de todos los dispositivos conectados. No modifica los permisos de usuarios registrados.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#f8fafc", padding: 20, paddingBottom: 48 },
  title: { fontSize: 26, color: "#0f172a", fontWeight: "800", marginBottom: 10 },
  intro: { fontSize: 15, lineHeight: 22, color: "#475569", marginBottom: 22 },
  card: { backgroundColor: "white", padding: 14, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, flexDirection: "row", alignItems: "center", marginBottom: 11 },
  disabled: { opacity: 0.6 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center", marginRight: 12 },
  info: { flex: 1, paddingRight: 8 },
  name: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 3 },
  detail: { color: "#64748b", fontSize: 12.5 },
  soon: { fontSize: 11, color: "#64748b" },
  note: { marginTop: 14, fontSize: 13, color: "#64748b", lineHeight: 20 },
});
