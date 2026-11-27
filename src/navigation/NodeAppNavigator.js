import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { I18nText as Text } from "@/src/i18n";
import AuthStack from "@/src/navigation/AuthStack";
import BarcodeSettingsScreen from "@/src/screens/settings/BarcodeSettingsScreen";
import SearchEngines from "@/src/screens/settings/SearchEngines";
import NodeSettingsSections from "@/src/screens/auth/node/NodeSettingsSections";
import { NodeSettingsUtility, UtilityCard } from "@/src/screens/auth/node/NodeUtilityScreens";
import NodeShoppingListsScreen, { openNodeDashboard } from "@/src/screens/auth/node/NodeShoppingListsScreen";
import NodeChatScreen from "@/src/screens/auth/node/NodeChatScreen";
import NodeProfileScreen from "@/src/screens/auth/node/NodeProfileScreen";
import { NodeResetPasswordScreen } from "@/src/screens/auth/node/NodeAuthScreens";
import NodeEmailChangeScreen from "@/src/screens/auth/node/NodeEmailChangeScreen";
import NodeMusicPlaylistsScreen from "@/src/screens/auth/node/NodeMusicPlaylistsScreen";
import NodeClassicalPlaylistsScreen from "@/src/screens/auth/node/NodeClassicalPlaylistsScreen";
import PlaybackProvider from "@/src/components/playback/PlaybackProvider";
import WebAlertModal from "@/src/components/ui/alert/WebAlertModal";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { useNodeAuth } from "@/src/context/NodeAuthContext";

const APP_MODE = String(process.env.EXPO_PUBLIC_APP_MODE || "development").trim().toLowerCase();
const ACCESS_MODE = String(process.env.EXPO_PUBLIC_ACCESS_MODE || "landing").trim().toLowerCase();
const DEFAULT_AUTH_ACCESS_MODE = APP_MODE === "development" ? "development" : ACCESS_MODE;
const CHAT_ACCESS_DIALOG = {
  type: "alert",
  title: "Acceso al chat",
  message: "Un administrador puede activar el permiso Chat de tu cuenta en Gestionar usuarios.",
};

function NodeTabs({ children, active, user, onSelect }) {
  const isAdmin = user.role === "admin";
  const tabs = [
    ["shopping", "Compras", "cart"],
    ...(isAdmin || user.permissions?.stores === true ? [["stores", "Tiendas", "storefront"]] : []),
    ...(isAdmin || user.permissions?.chat === true ? [["chat", "Chat", "chatbox-ellipses"]] : []),
    ...(isAdmin || user.permissions?.scanner === true ? [["scanner", "Escáner", "barcode"]] : []),
    ["settings", "Menú", "menu"],
  ];

  return (
    <View style={styles.shell}>
      <View style={styles.tabContent}>{children}</View>
      <SafeAreaView edges={["bottom", "left", "right"]} style={styles.tabBar}>
        {tabs.map(([id, label, icon]) => {
          const selected = id === active;
          const color = selected ? "#2563eb" : "#64748b";
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onSelect(id)}
              style={styles.tab}
            >
              <Ionicons name={icon} size={23} color={color} />
              <Text style={[styles.tabLabel, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </SafeAreaView>
    </View>
  );
}

function SessionRestoreError({ error, onRetry, onSignOut }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>No se pudo comprobar la sesión</Text>
      <Text style={styles.message}>{error || "Comprueba que Express esté disponible."}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Reintentar</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.linkButton} onPress={onSignOut}>
        <Text style={styles.linkText}>Volver al inicio de sesión</Text>
      </Pressable>
    </View>
  );
}

export default function NodeAppNavigator() {
  const [activeScreen, setActiveScreen] = useState(() => Platform.OS === "web" && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("shoppScreen") === "settings"
    ? "settings" : "shopping");
  const [profileOrigin, setProfileOrigin] = useState("shopping");
  const [showChatAccessDialog, setShowChatAccessDialog] = useState(false);
  const [signedOutAccessMode, setSignedOutAccessMode] = useState(DEFAULT_AUTH_ACCESS_MODE);
  const { status, user, accessToken, error, signOut, reloadSession, updateProfile, clearScanHistory, requestEmailChange, confirmEmailChange } = useNodeAuth();

  if (status === "loading") {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /><Text style={styles.message}>Comprobando sesión Node…</Text></View>;
  }
  if (status === "error") return <SessionRestoreError error={error} onRetry={reloadSession} onSignOut={signOut} />;
  if (status === "signed_in" && user) {
    const canUseChat = user.role === "admin" || user.permissions?.chat === true;
    const canUseClassical = user.role === "admin" || (user.permissions?.classicalMusic ?? true) === true;
    const openChat = () => {
      if (canUseChat) {
        setActiveScreen("chat");
        return;
      }
      if (Platform.OS === "web") {
        setShowChatAccessDialog(true);
        return;
      }
      safeAlert(CHAT_ACCESS_DIALOG.title, CHAT_ACCESS_DIALOG.message);
    };
    const withTabs = (screen, active = activeScreen) => (
      <NodeTabs user={user} active={active} onSelect={setActiveScreen}>{screen}</NodeTabs>
    );
    const openProfile = (origin) => {
      setProfileOrigin(origin);
      setActiveScreen("profile");
    };
    const backToSettings = () => setActiveScreen("settings");
    if (activeScreen === "settings") {
      return withTabs(<NodeSettingsUtility user={user} onProfile={() => openProfile("settings")}
        onDashboard={() => openNodeDashboard(user)} onSignOut={() => { setActiveScreen("shopping"); signOut(); }}
        onStoreRequests={() => setActiveScreen("storeRequests")} onStoreCatalog={() => setActiveScreen("storeCatalog")}>
        <NodeSettingsSections user={user} accessToken={accessToken}
          openBarcodeSettings={() => setActiveScreen("barcodeSettings")}
          openSearchEngines={() => setActiveScreen("searchEngines")} />
      </NodeSettingsUtility>);
    }
    if (activeScreen === "barcodeSettings" || activeScreen === "searchEngines") {
      return withTabs(
        <View style={styles.tabContent}>
          <UtilityCard icon="arrow-back" title="Volver a Ajustes" onPress={backToSettings} />
          {activeScreen === "barcodeSettings" ? <BarcodeSettingsScreen embedded /> : <SearchEngines embedded />}
        </View>,
        "settings",
      );
    }
    if (activeScreen === "profile") return withTabs(<NodeProfileScreen key={user.id} user={user} accessToken={accessToken} onBack={() => setActiveScreen(profileOrigin)} onUpdateProfile={updateProfile} onClearScanHistory={clearScanHistory} onChangePassword={() => setActiveScreen("password")} onChangeEmail={() => setActiveScreen("email")} />, ["storeRequests", "storeCatalog"].includes(profileOrigin) ? "settings" : profileOrigin);
    if (activeScreen === "email") return <NodeEmailChangeScreen user={user} onBack={() => setActiveScreen("profile")} onRequestCode={requestEmailChange} onConfirmCode={confirmEmailChange} onDone={() => { setSignedOutAccessMode("login"); signOut(); }} />;
    if (activeScreen === "music") return withTabs(<PlaybackProvider key="music"><NodeMusicPlaylistsScreen accessToken={accessToken} onBack={() => setActiveScreen("shopping")} /></PlaybackProvider>, "shopping");
    if (activeScreen === "classical" && canUseClassical) {
      return withTabs(
        <PlaybackProvider key="classical">
          <NodeClassicalPlaylistsScreen accessToken={accessToken} onBack={() => setActiveScreen("shopping")} />
        </PlaybackProvider>,
        "shopping",
      );
    }
    if (activeScreen === "password") {
      const navigation = {
        navigate: (routeName) => {
          if (routeName === "AuthHome") setActiveScreen("profile");
          if (routeName === "Login") {
            setSignedOutAccessMode("login");
            signOut();
          }
        },
      };
      return <NodeResetPasswordScreen route={{ params: { email: user.email } }} navigation={navigation} onPasswordResetComplete={() => { setSignedOutAccessMode("login"); signOut(); }} />;
    }
    if (activeScreen === "chat" && canUseChat) return withTabs(<NodeChatScreen user={user} accessToken={accessToken} onBack={() => setActiveScreen("shopping")} />);
    const closeChatAccessDialog = () => setShowChatAccessDialog(false);
    const storePage = user.role === "admin" ? { storeRequests: "validate", storeCatalog: "catalog" }[activeScreen] : undefined;
    const section = (
      (activeScreen === "stores" && (user.role === "admin" || user.permissions?.stores === true)) ||
      (activeScreen === "scanner" && (user.role === "admin" || user.permissions?.scanner === true))
    ) ? activeScreen : storePage ? "stores" : "shopping";
    return withTabs(
      <>
        <NodeShoppingListsScreen section={section} storePage={storePage} onBackFromStores={storePage ? backToSettings : undefined} user={user} accessToken={accessToken} onSignOut={signOut} onOpenProfile={() => openProfile(activeScreen)} onOpenMusic={() => setActiveScreen("music")} onOpenClassical={canUseClassical ? () => setActiveScreen("classical") : null} onOpenChat={openChat} />
        {showChatAccessDialog && !canUseChat && (
          <WebAlertModal
            dialog={CHAT_ACCESS_DIALOG}
            onSelect={closeChatAccessDialog}
            onClose={closeChatAccessDialog}
          />
        )}
      </>,
      storePage ? "settings" : section,
    );
  }

  return <AuthStack accessMode={signedOutAccessMode} backendProvider="node" />;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#fff" },
  tabContent: { flex: 1 },
  tabBar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e2e8f0", backgroundColor: "#fff" },
  tab: { flex: 1, minWidth: 0, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 5 },
  tabLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#f8fafc" },
  title: { color: "#0f172a", fontSize: 23, fontWeight: "800", textAlign: "center" },
  message: { color: "#64748b", fontSize: 15, lineHeight: 22, marginTop: 12, textAlign: "center" },
  button: { backgroundColor: "#2563eb", borderRadius: 12, marginTop: 22, minHeight: 48, justifyContent: "center", paddingHorizontal: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  linkButton: { padding: 14, marginTop: 6 },
  linkText: { color: "#2563eb", fontWeight: "700" },
});
