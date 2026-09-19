import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

export default function InvestmentsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.iconBox}>
        <Ionicons name="trending-up-outline" size={36} color="#15803d" />
      </View>
      <Text style={styles.title}>Inversiones</Text>
      <Text style={styles.subtitle}>Acciones y criptomonedas</Text>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Funcionalidad en desarrollo</Text>
        <Text style={styles.noticeText}>
          Aquí podrás explorar una cartera simulada antes de conectar una cuenta
          con un proveedor de negociación. Todavía no hay precios ni operaciones
          reales disponibles en Shopp.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flexGrow: 1, alignItems: "center", padding: 24, paddingTop: 60 },
  iconBox: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dcfce7",
  },
  title: { marginTop: 18, fontSize: 26, fontWeight: "800", color: "#0f172a" },
  subtitle: { marginTop: 4, fontSize: 15, color: "#64748b" },
  notice: {
    width: "100%",
    maxWidth: 480,
    marginTop: 28,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#fff",
  },
  noticeTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  noticeText: { marginTop: 8, fontSize: 14, lineHeight: 21, color: "#475569" },
});
