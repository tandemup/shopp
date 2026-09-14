import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/convex/_generated/api";
import { I18nText as Text } from "@/src/i18n";
import { isAdminUser } from "@/src/utils/featureAccess";

export function AdminOnlyFeature({ children, title = "Funcionalidad en desarrollo" }) {
  const currentUser = useQuery(api.users.current);

  if (currentUser === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!isAdminUser(currentUser)) {
    return (
      <View style={styles.centered}>
        <View style={styles.iconBox}>
          <Ionicons name="construct-outline" size={30} color="#C2410C" />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>DEV</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>
          Esta función está en desarrollo y, por el momento, solo está
          disponible para administradores.
        </Text>
      </View>
    );
  }

  return children;
}

export function adminOnly(Component, title) {
  function AdminOnlyScreen(props) {
    return (
      <AdminOnlyFeature title={title}>
        <Component {...props} />
      </AdminOnlyFeature>
    );
  }

  AdminOnlyScreen.displayName = `AdminOnly(${Component.displayName || Component.name || "Screen"})`;
  return AdminOnlyScreen;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#F8FAFC",
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1E7",
    marginBottom: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
    marginBottom: 12,
  },
  badgeText: { color: "#B42318", fontSize: 12, fontWeight: "900" },
  title: {
    color: "#172033",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    maxWidth: 430,
    color: "#667085",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});

