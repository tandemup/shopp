import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useAction, useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { I18nText as Text } from "@/src/i18n";
import BrowserViewport from "@/src/components/browser/BrowserViewport";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const DEFAULT_URL = "https://example.com";
const CLIENT_ID_KEY = "shopp-chat-client-id";

function getClientId() {
  if (typeof window !== "undefined") {
    const saved = window.localStorage?.getItem(CLIENT_ID_KEY);
    if (saved) return saved;
    const next = globalThis.crypto?.randomUUID?.() || `library-${Date.now()}`;
    window.localStorage?.setItem(CLIENT_ID_KEY, next);
    return next;
  }

  return `library-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getPreviewTitle(preview, hostname) {
  if (preview?.fallback) return "";
  const title = String(preview?.title || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return "";
  if (title.toLowerCase() === String(hostname || "").toLowerCase()) return "";
  return title.slice(0, 240);
}

function normalizeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function ToolbarButton({ icon, label, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolbarButton,
        pressed && styles.toolbarButtonPressed,
      ]}
    >
      <Ionicons name={icon} size={20} color="#334155" />
    </Pressable>
  );
}

export default function BrowserScreen() {
  const navigation = useNavigation();
  const viewportRef = useRef(null);
  const [clientId] = useState(getClientId);
  const addUrl = useMutation(api.computerLinks.addUrl);
  const updatePreviewMetadata = useMutation(
    api.computerLinks.updatePreviewMetadata,
  );
  const getLinkPreview = useAction(api.linkPreviews.get);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_URL);
  const [address, setAddress] = useState(DEFAULT_URL);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  const hostname = useMemo(() => {
    try {
      return new URL(currentUrl).hostname;
    } catch (_error) {
      return currentUrl;
    }
  }, [currentUrl]);

  const isSecure = /^https:\/\//i.test(currentUrl);

  const navigate = useCallback(() => {
    const nextUrl = normalizeUrl(address);
    if (!nextUrl) {
      safeAlert(
        "Dirección no válida",
        "Introduce una URL o dominio, por ejemplo: example.com",
      );
      return;
    }

    Keyboard.dismiss();
    setAddress(nextUrl);
    setCurrentUrl(nextUrl);
    setUrl(nextUrl);
  }, [address]);

  const reload = useCallback(() => {
    if (Platform.OS === "web") {
      setReloadKey((value) => value + 1);
      return;
    }
    viewportRef.current?.reload?.();
  }, []);

  const saveToLibrary = useCallback(async () => {
    if (savingToLibrary) return;

    const normalizedUrl = normalizeUrl(currentUrl);
    if (!normalizedUrl) {
      safeAlert(
        "No se puede guardar",
        "La página actual no tiene una URL http o https válida.",
      );
      return;
    }

    setSavingToLibrary(true);
    try {
      const result = await addUrl({
        url: normalizedUrl,
        clientId,
        username: "Biblioteca",
        linkType: "general",
      });

      // Biblioteca obtiene los metadatos desde backend, de modo que funciona
      // también en Web aunque el iframe sea cross-origin y no podamos leer su DOM.
      if (result?.linkId) {
        try {
          const preview = await getLinkPreview({ url: normalizedUrl });
          const parsedHostname = new URL(normalizedUrl).hostname
            .replace(/^www\./i, "")
            .toLowerCase();
          const title = getPreviewTitle(preview, parsedHostname);
          const publishedAt = Number(preview?.publishedAt || 0) || null;

          if (title || publishedAt) {
            await updatePreviewMetadata({
              linkId: result.linkId,
              customTitle: title || undefined,
              publishedAt: publishedAt || undefined,
            });
          }
        } catch (previewError) {
          console.warn(
            "[BrowserScreen] preview metadata failed",
            previewError,
          );
        }
      }

      safeAlert(
        result?.existing ? "Ya estaba en Biblioteca" : "Guardada en Biblioteca",
        normalizedUrl,
      );
    } catch (error) {
      console.warn("[BrowserScreen] save to library failed", error);
      safeAlert(
        "No se pudo guardar",
        error?.message || "No fue posible añadir esta página a Biblioteca.",
      );
    } finally {
      setSavingToLibrary(false);
    }
  }, [
    addUrl,
    clientId,
    currentUrl,
    getLinkPreview,
    savingToLibrary,
    updatePreviewMetadata,
  ]);

  const openExternal = useCallback(async () => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(currentUrl, "_blank", "noopener,noreferrer");
        return;
      }
      await Linking.openURL(currentUrl);
    } catch (error) {
      console.warn("[BrowserScreen] open external failed", error);
      safeAlert("No se pudo abrir", currentUrl);
    }
  }, [currentUrl]);

  const goHome = useCallback(() => {
    setAddress(DEFAULT_URL);
    setCurrentUrl(DEFAULT_URL);
    setUrl(DEFAULT_URL);
  }, []);

  const handleNativeUrlChange = useCallback((nextUrl) => {
    if (!nextUrl || !/^https?:\/\//i.test(nextUrl)) return;
    setAddress(nextUrl);
    setCurrentUrl(nextUrl);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ToolbarButton
            icon="chevron-back"
            label="Volver a Shopp"
            onPress={() => navigation.goBack()}
          />
          <View style={styles.titleIcon}>
            <Ionicons name="globe-outline" size={20} color="#2563EB" />
          </View>
          <View style={styles.titleText}>
            <Text style={styles.title}>Navegador</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {hostname}
            </Text>
          </View>

          <ToolbarButton
            icon="open-outline"
            label="Abrir en navegador externo"
            onPress={openExternal}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guardar página en Biblioteca"
          disabled={savingToLibrary}
          onPress={saveToLibrary}
          style={({ pressed }) => [
            styles.libraryButton,
            pressed && !savingToLibrary && styles.libraryButtonPressed,
            savingToLibrary && styles.libraryButtonDisabled,
          ]}
        >
          {savingToLibrary ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Ionicons name="bookmark-outline" size={18} color="#2563EB" />
          )}
          <Text style={styles.libraryButtonText}>
            {savingToLibrary ? "Guardando…" : "Guardar en Biblioteca"}
          </Text>
        </Pressable>

        <View style={styles.addressRow}>
          <ToolbarButton icon="home-outline" label="Inicio" onPress={goHome} />
          <ToolbarButton icon="reload-outline" label="Recargar" onPress={reload} />

          <View style={styles.addressBox}>
            <Ionicons
              name={isSecure ? "lock-closed-outline" : "warning-outline"}
              size={15}
              color={isSecure ? "#64748B" : "#D97706"}
            />
            <TextInput
              value={address}
              onChangeText={setAddress}
              onSubmitEditing={navigate}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
              placeholder="https://example.com"
              placeholderTextColor="#94A3B8"
              style={styles.addressInput}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir a la dirección"
            onPress={navigate}
            style={({ pressed }) => [
              styles.goButton,
              pressed && styles.goButtonPressed,
            ]}
          >
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {Platform.OS === "web" ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color="#475569" />
          <Text style={styles.noticeText} numberOfLines={2}>
            Algunas webs impiden mostrarse dentro de un iframe. En ese caso usa el botón de abrir externamente.
          </Text>
        </View>
      ) : null}

      <View style={styles.browserArea}>
        <BrowserViewport
          ref={viewportRef}
          url={url}
          reloadKey={reloadKey}
          onUrlChange={handleNativeUrlChange}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#CBD5E1",
    gap: 9,
  },
  titleRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },
  titleText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 1,
    color: "#64748B",
    fontSize: 12,
  },
  libraryButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  libraryButtonPressed: {
    backgroundColor: "#DBEAFE",
  },
  libraryButtonDisabled: {
    opacity: 0.65,
  },
  libraryButtonText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "800",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  toolbarButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  toolbarButtonPressed: {
    opacity: 0.65,
  },
  addressBox: {
    flex: 1,
    minWidth: 0,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    gap: 7,
  },
  addressInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    color: "#0F172A",
    fontSize: 14,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}),
  },
  goButton: {
    width: 40,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
  goButtonPressed: {
    backgroundColor: "#1D4ED8",
  },
  notice: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#F1F5F9",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#CBD5E1",
  },
  noticeText: {
    flex: 1,
    color: "#475569",
    fontSize: 12,
    lineHeight: 16,
  },
  browserArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: "#FFFFFF",
  },
});
