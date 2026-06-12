// components/features/scanner/ScannerOverlay.web.js

import React from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

/* -------------------------------------------------
   Component
-------------------------------------------------- */

export default function ScannerOverlay({
  onCancel,

  onChangeZoom,
  onToggleTorch,

  zoomLabel = "1.2x",
  torchEnabled = false,

  zoomAvailable = true,
  torchAvailable = true,

  showControls = true,

  hint = "Apunta al código de barras",

  title = "Leer código de barras",

  subtitle = "El número se procesará automáticamente cuando sea detectado.",

  processing = false,

  starting = false,

  errorMessage = "",

  onRetry,
}) {
  const zoomControlLabel = zoomAvailable ? `Zoom ${zoomLabel}` : "Sin zoom";

  const torchControlLabel = torchAvailable
    ? `Linterna ${torchEnabled ? "ON" : "OFF"}`
    : "Sin linterna";

  return (
    <View style={[styles.overlay, styles.pointerEventsBoxNone]}>
      {/* Botón cerrar */}
      <Pressable
        style={[styles.closeButton, styles.pointerEventsAuto]}
        onPress={onCancel}
      >
        <Ionicons name="close" size={46} color="#FFFFFF" />
      </Pressable>

      {/* Zona central */}
      <View style={[styles.scanArea, styles.pointerEventsBoxNone]}>
        <View style={[styles.scanFrame, styles.pointerEventsNone]}>
          <View style={styles.scanLine} />
        </View>

        <Text style={[styles.hint, styles.pointerEventsNone]}>{hint}</Text>

        {/* Botones grandes */}
        {showControls ? (
          <View style={[styles.controlsRow, styles.pointerEventsBoxNone]}>
            <Pressable
              style={[
                styles.controlButton,
                !zoomAvailable && styles.controlButtonDisabled,
                styles.pointerEventsAuto,
              ]}
              onPress={onChangeZoom}
              disabled={!zoomAvailable || !onChangeZoom}
            >
              <Ionicons name="scan-outline" size={22} color="#111827" />

              <Text style={styles.controlButtonText}>{zoomControlLabel}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.controlButton,
                torchEnabled && styles.controlButtonActive,
                !torchAvailable && styles.controlButtonDisabled,
                styles.pointerEventsAuto,
              ]}
              onPress={onToggleTorch}
              disabled={!torchAvailable || !onToggleTorch}
            >
              <Ionicons
                name={torchEnabled ? "flashlight" : "flashlight-outline"}
                size={22}
                color="#111827"
              />

              <Text style={styles.controlButtonText}>{torchControlLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Panel inferior */}
      <View style={[styles.bottomPanel, styles.pointerEventsBoxNone]}>
        <Text style={styles.title}>{title}</Text>

        <Text style={styles.subtitle}>{subtitle}</Text>

        <Pressable
          style={[styles.cancelButton, styles.pointerEventsAuto]}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </Pressable>

        {processing ? (
          <View style={[styles.messageRow, styles.pointerEventsNone]}>
            <ActivityIndicator color="#FFFFFF" />

            <Text style={styles.processingText}>Procesando...</Text>
          </View>
        ) : null}

        {starting ? (
          <Text style={styles.startingText}>Iniciando cámara...</Text>
        ) : null}

        {errorMessage ? (
          <>
            <Text style={styles.errorText}>{errorMessage}</Text>

            {onRetry ? (
              <Pressable
                style={[styles.retryButton, styles.pointerEventsAuto]}
                onPress={onRetry}
              >
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    overflow: "hidden",
    backgroundColor: "transparent",
  },

  closeButton: {
    position: "absolute",
    top: 22,
    right: 18,
    zIndex: 40,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  scanArea: {
    position: "absolute",
    top: "22%",
    left: 18,
    right: 18,
    alignItems: "center",
  },

  scanFrame: {
    width: "100%",
    maxWidth: 540,
    height: 136,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },

  scanLine: {
    width: "88%",
    height: 4,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },

  hint: {
    marginTop: 24,
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.90)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 4,
  },

  controlsRow: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },

  controlButton: {
    minWidth: 160,
    minHeight: 58,
    paddingHorizontal: 18,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "#F3F4F6",
  },

  controlButtonActive: {
    backgroundColor: "#FDE68A",
  },

  controlButtonDisabled: {
    opacity: 0.72,
  },

  controlButtonText: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },

  bottomPanel: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 30,
    alignItems: "center",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.90)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 4,
  },

  subtitle: {
    maxWidth: 380,
    marginTop: 10,
    color: "rgba(255,255,255,0.90)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.90)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 4,
  },

  cancelButton: {
    minWidth: 238,
    minHeight: 58,
    marginTop: 22,
    paddingHorizontal: 22,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.30)",
  },

  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },

  messageRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  processingText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  startingText: {
    marginTop: 12,
    color: "#BFDBFE",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  errorText: {
    maxWidth: 420,
    marginTop: 12,
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },

  retryButton: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#2563EB",
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  /*
   * React Native Web recomienda definir pointerEvents
   * dentro del objeto style.
   */
  pointerEventsNone: {
    pointerEvents: "none",
  },

  pointerEventsAuto: {
    pointerEvents: "auto",
  },

  pointerEventsBoxNone: {
    pointerEvents: "box-none",
  },
});
