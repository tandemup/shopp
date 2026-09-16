import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { I18nText as Text } from "@/src/i18n";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import AuthStack from "@/src/navigation/AuthStack";
import MainTabs from "@/src/navigation/MainTabs";
import PlaybackProvider from "@/src/components/playback/PlaybackProvider";
import SplashScreen from "@/src/screens/system/SplashScreen";

export default function AppNavigator() {
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  if (showSplash) {
    return <SplashScreen onFinish={finishSplash} />;
  }

  return (
    <>
      <AuthLoading>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Cargando Shopp...</Text>
        </View>
      </AuthLoading>

      <Unauthenticated>
        <AuthStack />
      </Unauthenticated>

      <Authenticated>
        <PlaybackProvider>
          <MainTabs />
        </PlaybackProvider>
      </Authenticated>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#475569",
    fontWeight: "600",
  },
});
