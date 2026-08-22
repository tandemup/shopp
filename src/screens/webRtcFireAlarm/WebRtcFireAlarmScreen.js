import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { I18nText as Text } from "@/src/i18n";

const COLORS = {
  background: "#F4F7FB",
  surface: "#FFFFFF",
  text: "#172033",
  textMuted: "#667085",
  border: "#E4E7EC",
  red: "#DC2626",
  redDark: "#B91C1C",
  redSoft: "#FEE2E2",
  green: "#15803D",
  greenSoft: "#ECFDF3",
  amber: "#B45309",
  amberSoft: "#FFF7ED",
};

function StatusPill({ active }) {
  return (
    <View style={[styles.statusPill, active ? styles.statusActive : styles.statusIdle]}>
      <View style={[styles.statusDot, active ? styles.dotActive : styles.dotIdle]} />
      <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextIdle]}>
        {active ? "Cámara activa" : "Cámara detenida"}
      </Text>
    </View>
  );
}

export default function WebRtcFireAlarmScreen() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [alarm, setAlarm] = useState(false);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError("");

    if (Platform.OS !== "web") {
      setError("Este primer prototipo usa WebRTC del navegador y está disponible en la versión Web/PWA.");
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("El navegador no ofrece acceso compatible a la cámara mediante getUserMedia().");
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play?.();
      }
      setActive(true);
    } catch (e) {
      console.warn("[WebRtcFireAlarm] camera error", e);
      setError("No se pudo abrir la cámara. Comprueba el permiso del navegador y que la página se sirva mediante HTTPS.");
    }
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="flame" size={27} color="#FFFFFF" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.title}>WebRTC Fire Alarm</Text>
            <Text style={styles.subtitle}>
              Cámara de vigilancia y verificación visual de un posible incendio.
            </Text>
          </View>
          <StatusPill active={active} />
        </View>

        <View style={styles.videoCard}>
          {Platform.OS === "web" ? (
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", background: "#111827" }}
            />
          ) : (
            <View style={styles.nativePlaceholder}>
              <Ionicons name="videocam-outline" size={46} color={COLORS.textMuted} />
              <Text style={styles.nativePlaceholderText}>Vista de cámara Web/PWA</Text>
            </View>
          )}

          <View style={styles.videoFooter}>
            <View>
              <Text style={styles.cameraLabel}>Cámara local</Text>
              <Text style={styles.cameraMeta}>Vídeo permanece local hasta iniciar una sesión WebRTC.</Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={21} color={COLORS.amber} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable
            onPress={active ? stopCamera : startCamera}
            style={({ pressed }) => [
              styles.primaryButton,
              active && styles.stopButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name={active ? "stop-circle-outline" : "videocam-outline"} size={21} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{active ? "Detener cámara" : "Activar cámara"}</Text>
          </Pressable>

          <Pressable
            onPress={() => setAlarm((value) => !value)}
            style={({ pressed }) => [styles.alarmButton, alarm && styles.alarmButtonActive, pressed && styles.buttonPressed]}
          >
            <Ionicons name="warning-outline" size={21} color={alarm ? "#FFFFFF" : COLORS.red} />
            <Text style={[styles.alarmButtonText, alarm && styles.alarmButtonTextActive]}>
              {alarm ? "Cancelar alarma" : "Simular incendio"}
            </Text>
          </Pressable>
        </View>

        {alarm ? (
          <View style={styles.fireAlert}>
            <View style={styles.fireAlertIcon}>
              <Ionicons name="flame" size={25} color="#FFFFFF" />
            </View>
            <View style={styles.fireAlertBody}>
              <Text style={styles.fireAlertTitle}>Posible incendio</Text>
              <Text style={styles.fireAlertText}>
                Alarma de prueba activa. Verifica visualmente la escena antes de escalar el aviso.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Siguiente fase</Text>
          <View style={styles.infoItem}>
            <Ionicons name="swap-horizontal-outline" size={19} color={COLORS.red} />
            <Text style={styles.infoText}>Crear RTCPeerConnection y señalización para enviar vídeo a un segundo navegador.</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="eye-outline" size={19} color={COLORS.red} />
            <Text style={styles.infoText}>Añadir detección local de humo/fuego como módulo independiente.</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="notifications-outline" size={19} color={COLORS.red} />
            <Text style={styles.infoText}>Enviar una alerta al responsable y permitir verificación humana del vídeo.</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Fire Alarm es una ayuda de vigilancia y verificación visual. No sustituye sistemas certificados de detección de incendios ni los procedimientos oficiales de emergencia.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { width: "100%", maxWidth: 920, alignSelf: "center", padding: 16, paddingBottom: 80 },
  hero: { padding: 18, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20 },
  heroIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.red, borderRadius: 16 },
  heroText: { flex: 1, minWidth: 220 },
  title: { color: COLORS.text, fontSize: 23, fontWeight: "900" },
  subtitle: { marginTop: 4, color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  statusPill: { minHeight: 32, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", borderRadius: 16 },
  statusActive: { backgroundColor: COLORS.greenSoft },
  statusIdle: { backgroundColor: "#F2F4F7" },
  statusDot: { width: 8, height: 8, marginRight: 7, borderRadius: 4 },
  dotActive: { backgroundColor: COLORS.green },
  dotIdle: { backgroundColor: COLORS.textMuted },
  statusText: { fontSize: 11, fontWeight: "800" },
  statusTextActive: { color: COLORS.green },
  statusTextIdle: { color: COLORS.textMuted },
  videoCard: { marginTop: 14, overflow: "hidden", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20 },
  nativePlaceholder: { aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center", backgroundColor: "#E5E7EB" },
  nativePlaceholderText: { marginTop: 8, color: COLORS.textMuted, fontWeight: "700" },
  videoFooter: { padding: 14 },
  cameraLabel: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  cameraMeta: { marginTop: 3, color: COLORS.textMuted, fontSize: 11, lineHeight: 16 },
  errorCard: { marginTop: 12, padding: 13, flexDirection: "row", gap: 9, backgroundColor: COLORS.amberSoft, borderRadius: 15 },
  errorText: { flex: 1, color: COLORS.amber, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  actionsRow: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryButton: { minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.red, borderRadius: 14 },
  stopButton: { backgroundColor: COLORS.text },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  alarmButton: { minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.red, borderRadius: 14 },
  alarmButtonActive: { backgroundColor: COLORS.red },
  alarmButtonText: { color: COLORS.red, fontSize: 13, fontWeight: "800" },
  alarmButtonTextActive: { color: "#FFFFFF" },
  buttonPressed: { opacity: 0.82 },
  fireAlert: { marginTop: 14, padding: 15, flexDirection: "row", gap: 12, backgroundColor: COLORS.redSoft, borderWidth: 1, borderColor: "#FCA5A5", borderRadius: 18 },
  fireAlertIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.red, borderRadius: 14 },
  fireAlertBody: { flex: 1 },
  fireAlertTitle: { color: COLORS.redDark, fontSize: 16, fontWeight: "900" },
  fireAlertText: { marginTop: 4, color: COLORS.redDark, fontSize: 12, lineHeight: 18 },
  infoCard: { marginTop: 18, padding: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20 },
  infoTitle: { marginBottom: 10, color: COLORS.text, fontSize: 16, fontWeight: "900" },
  infoItem: { marginTop: 8, flexDirection: "row", alignItems: "flex-start", gap: 9 },
  infoText: { flex: 1, color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  disclaimer: { marginTop: 18, color: COLORS.textMuted, fontSize: 11, lineHeight: 17, textAlign: "center" },
});
