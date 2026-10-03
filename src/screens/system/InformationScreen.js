import React from "react";
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

const FEATURES = [
  { icon: "cart-outline", title: "Lista de la compra", description: "Organiza listas, calcula el importe de la compra y conserva tu historial." },
  { icon: "barcode-outline", title: "Escáner", description: "Escanea códigos de barras para registrar y consultar productos." },
  { icon: "musical-notes-outline", title: "Música y playlists", description: "Crea listas de reproducción y tarjetas musicales con códigos QR." },
  { icon: "disc-outline", title: "Música clásica", description: "Organiza y disfruta de obras, intérpretes y conciertos." },
  { icon: "library-outline", title: "Biblioteca", description: "Guarda noticias, enlaces y recursos organizados por categorías." },
  { icon: "school-outline", title: "Tutoriales", description: "Reúne tutoriales y vídeos de tus temas favoritos." },
  { icon: "swap-horizontal-outline", title: "Intercambio P2P", description: "Comparte playlists y sincroniza contenido entre tus dispositivos." },
];

export default function InformationScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
          <Text style={styles.brandText}>Shopp</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a la portada"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back-outline" size={18} color="#2563eb" />
          <Text style={styles.backText}>Volver</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.introduction}>
          <Ionicons name="information-circle-outline" size={40} color="#2563eb" />
          <Text style={styles.title}>Descubre Shopp</Text>
          <Text style={styles.subtitle}>Tus herramientas cotidianas en una sola aplicación.</Text>
          <Text style={styles.note}>Shopp está en desarrollo. Algunas funcionalidades pueden estar restringidas o todavía no estar disponibles.</Text>
        </View>
        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureCard}>
              <Ionicons name={feature.icon} size={27} color="#2563eb" />
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Ver el proyecto Shopp en GitHub"
          onPress={() => Linking.openURL("https://github.com/tandemup/shopp")}
          style={({ pressed }) => [styles.githubButton, pressed && styles.pressed]}
        >
          <Ionicons name="logo-github" size={20} color="#0f172a" />
          <Text style={styles.githubText}>Ver proyecto en GitHub</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  header: { minHeight: 68, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb" },
  logoText: { color: "white", fontSize: 18, fontWeight: "900" },
  brandText: { color: "#0f172a", fontSize: 22, fontWeight: "900" },
  backButton: { flexDirection: "row", gap: 5, alignItems: "center", padding: 10, borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 10 },
  backText: { color: "#2563eb", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.75 },
  scrollContent: { padding: 24, alignItems: "center", paddingBottom: 56 },
  introduction: { width: "100%", maxWidth: 850, alignItems: "center", gap: 12, marginBottom: 25 },
  title: { color: "#0f172a", fontSize: 29, fontWeight: "900", textAlign: "center" },
  subtitle: { color: "#475569", fontSize: 17, textAlign: "center" },
  note: { color: "#64748b", fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 4 },
  features: { width: "100%", maxWidth: 850, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
  featureCard: { flexGrow: 1, flexBasis: 215, maxWidth: 410, padding: 22, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, backgroundColor: "white", gap: 10 },
  featureTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800" },
  featureDescription: { color: "#64748b", fontSize: 14, lineHeight: 21 },
  githubButton: { marginTop: 28, flexDirection: "row", alignItems: "center", gap: 9, padding: 13, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, backgroundColor: "white" },
  githubText: { fontWeight: "700", fontSize: 14, color: "#0f172a" },
});
