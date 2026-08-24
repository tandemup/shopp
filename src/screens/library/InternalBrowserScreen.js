import React, { useMemo, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return /^https?:$/.test(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

export default function InternalBrowserScreen({ navigation, route }) {
  const url = useMemo(() => normalizeUrl(route?.params?.url), [route?.params?.url]);
  const [frameKey, setFrameKey] = useState(0);

  const openOutside = async () => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn("[InternalBrowser] No se pudo abrir la URL", error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.toolbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="close" size={24} color="#0f172a" />
        </Pressable>
        <View style={styles.addressBox}>
          <Ionicons name="lock-closed-outline" size={14} color="#64748b" />
          <Text style={styles.address} numberOfLines={1}>
            {url || "URL no válida"}
          </Text>
        </View>
        <Pressable
          onPress={() => setFrameKey((value) => value + 1)}
          disabled={!url || Platform.OS !== "web"}
          style={styles.iconButton}
        >
          <Ionicons name="refresh" size={21} color="#2563eb" />
        </Pressable>
        <Pressable onPress={openOutside} disabled={!url} style={styles.iconButton}>
          <Ionicons name="open-outline" size={21} color="#2563eb" />
        </Pressable>
      </View>

      <View style={styles.content}>
        {!url ? (
          <View style={styles.messageBox}>
            <Ionicons name="warning-outline" size={36} color="#dc2626" />
            <Text style={styles.messageTitle}>No se puede abrir este enlace</Text>
          </View>
        ) : Platform.OS === "web" ? (
          React.createElement("iframe", {
            key: frameKey,
            src: url,
            title: "Navegador de Biblioteca",
            style: styles.iframe,
            allow: "clipboard-read; clipboard-write; fullscreen",
            referrerPolicy: "strict-origin-when-cross-origin",
          })
        ) : (
          <View style={styles.messageBox}>
            <Ionicons name="globe-outline" size={38} color="#2563eb" />
            <Text style={styles.messageTitle}>Vista interna disponible en la PWA</Text>
            <Text style={styles.messageText}>
              En este dispositivo puedes abrir la página con el navegador del sistema.
            </Text>
            <Pressable onPress={openOutside} style={styles.externalButton}>
              <Text style={styles.externalButtonText}>Abrir en navegador</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={16} color="#64748b" />
        <Text style={styles.footerText} numberOfLines={2}>
          Si la página no aparece, el sitio puede estar bloqueando su carga dentro de un iframe.
        </Text>
        <Pressable onPress={openOutside} style={styles.openTextButton}>
          <Text style={styles.openText}>Abrir fuera</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  toolbar: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  addressBox: {
    flex: 1,
    minWidth: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
  },
  address: { flex: 1, fontSize: 11, color: "#475569" },
  content: { flex: 1, backgroundColor: "#fff" },
  iframe: { width: "100%", height: "100%", border: 0, backgroundColor: "#fff" },
  messageBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  messageTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "900",
    color: "#1e293b",
    textAlign: "center",
  },
  messageText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: "#64748b",
    textAlign: "center",
  },
  externalButton: {
    marginTop: 16,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#2563eb",
  },
  externalButtonText: { fontSize: 13, fontWeight: "900", color: "#fff" },
  footer: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  footerText: { flex: 1, fontSize: 10, lineHeight: 14, color: "#64748b" },
  openTextButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 5 },
  openText: { fontSize: 11, fontWeight: "900", color: "#2563eb" },
});
