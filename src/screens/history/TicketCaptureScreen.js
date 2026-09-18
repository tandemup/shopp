import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import Slider from "@react-native-community/slider";
import { captureRef } from "react-native-view-shot";

import { I18nText as Text } from "@/src/i18n";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const TARGET_WIDTH = 1400;
const DEFAULT_OVERLAP = 0.35;

async function normalizePhoto(photo) {
  const width = Number(photo?.width) || TARGET_WIDTH;
  const height = Number(photo?.height) || TARGET_WIDTH;
  const targetHeight = Math.max(1, Math.round((height * TARGET_WIDTH) / width));
  const result = await ImageManipulator.manipulateAsync(
    photo.uri,
    [{ resize: { width: TARGET_WIDTH, height: targetHeight } }],
    { compress: 0.96, format: ImageManipulator.SaveFormat.JPEG },
  );

  return { uri: result.uri, width: result.width, height: result.height };
}

export default function TicketCaptureScreen() {
  const cameraRef = useRef(null);
  const compositionRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState([]);
  const [overlap, setOverlap] = useState(DEFAULT_OVERLAP);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const previewWidth = Math.min(windowWidth - 32, 520);
  const sections = useMemo(
    () =>
      photos.map((photo, index) => {
        const cropTop = index === 0 ? 0 : Math.round(photo.height * overlap);
        return {
          ...photo,
          cropTop,
          visibleHeight: photo.height - cropTop,
        };
      }),
    [overlap, photos],
  );

  const composedHeight = useMemo(
    () => sections.reduce((sum, section) => sum + section.visibleHeight, 0),
    [sections],
  );

  const openCamera = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        safeAlert("Permiso necesario", "Shopp necesita acceso a la cámara.");
        return;
      }
    }
    setCameraVisible(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });
      const normalized = await normalizePhoto(photo);
      setPhotos((current) => [...current, normalized]);
      setCameraVisible(false);
    } catch (error) {
      console.warn("[TicketCapture] capture failed", error);
      safeAlert("No se pudo guardar la foto", "Vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const saveTicket = useCallback(async () => {
    if (!compositionRef.current || sections.length === 0 || busy) return;
    setBusy(true);
    try {
      let MediaLibrary = null;

      if (Platform.OS !== "web") {
        // Carga diferida: expo-media-library es un módulo nativo y no debe
        // evaluarse al arrancar la versión web de Shopp.
        MediaLibrary = await import("expo-media-library");
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
          safeAlert("Permiso necesario", "Activa Fotos para guardar el ticket.");
          return;
        }
      }

      const uri = await captureRef(compositionRef, {
        format: "jpg",
        quality: 0.96,
        width: TARGET_WIDTH,
        height: composedHeight,
        result: Platform.OS === "web" ? "data-uri" : "tmpfile",
      });

      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = uri;
        link.download = `ticket-${Date.now()}.jpg`;
        link.click();
      } else {
        await MediaLibrary.saveToLibraryAsync(uri);
      }
      safeAlert("Ticket guardado", "Se ha creado una sola imagen en alta calidad.");
    } catch (error) {
      console.warn("[TicketCapture] compose failed", error);
      safeAlert(
        "No se pudo componer el ticket",
        "Prueba con menos fotografías o reduce el solape.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, composedHeight, sections.length]);

  if (cameraVisible) {
    return (
      <View style={styles.cameraScreen}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        {photos.length > 0 ? (
          <View pointerEvents="none" style={styles.alignmentGuide}>
            <Text style={styles.alignmentText}>
              Repite aquí el último 35 % de la foto anterior
            </Text>
          </View>
        ) : null}
        <View style={styles.cameraControls}>
          <Pressable style={styles.cameraButtonSecondary} onPress={() => setCameraVisible(false)}>
            <Text style={styles.cameraButtonText}>Cancelar</Text>
          </Pressable>
          <Pressable disabled={busy} style={styles.shutter} onPress={takePhoto}>
            {busy ? <ActivityIndicator color="#2563EB" /> : <View style={styles.shutterInner} />}
          </Pressable>
          <View style={styles.cameraSpacer} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Ticket largo</Text>
      <Text style={styles.help}>
        Fotografía de arriba abajo. Repite entre el 30 % y el 40 % del tramo anterior y mantén el móvil paralelo al papel.
      </Text>

      <View style={styles.actionRow}>
        <Pressable style={styles.primaryButton} onPress={openCamera}>
          <Ionicons name="camera" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {photos.length ? "Añadir tramo" : "Primera foto"}
          </Text>
        </Pressable>
        <Pressable
          disabled={!photos.length || busy}
          style={[styles.saveButton, (!photos.length || busy) && styles.disabled]}
          onPress={saveTicket}
        >
          <Ionicons name="download-outline" size={20} color="#1D4ED8" />
          <Text style={styles.saveButtonText}>Generar imagen</Text>
        </Pressable>
      </View>

      {photos.length > 1 ? (
        <View style={styles.overlapCard}>
          <Text style={styles.overlapTitle}>Solape: {Math.round(overlap * 100)} %</Text>
          <Slider
            minimumValue={0.2}
            maximumValue={0.5}
            step={0.01}
            value={overlap}
            onValueChange={setOverlap}
            minimumTrackTintColor="#2563EB"
            maximumTrackTintColor="#CBD5E1"
          />
          <Text style={styles.note}>
            Ajusta el control hasta que no se repitan líneas del ticket.
          </Text>
        </View>
      ) : null}

      {photos.length ? (
        <>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Vista previa · {photos.length} fotos</Text>
            <Pressable onPress={() => setPhotos((current) => current.slice(0, -1))}>
              <Text style={styles.removeText}>Quitar última</Text>
            </Pressable>
          </View>
          <View ref={compositionRef} collapsable={false} style={[styles.composition, { width: previewWidth }]}>
            {sections.map((section, index) => {
              const scale = previewWidth / section.width;
              const imageHeight = section.height * scale;
              const cropTop = section.cropTop * scale;
              return (
                <View
                  key={`${section.uri}-${index}`}
                  style={{ width: previewWidth, height: section.visibleHeight * scale, overflow: "hidden" }}
                >
                  <Image
                    source={{ uri: section.uri }}
                    resizeMode="stretch"
                    style={{ width: previewWidth, height: imageHeight, marginTop: -cropTop }}
                  />
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Todavía no hay fotografías</Text>
          <Text style={styles.note}>Las imágenes permanecen en el teléfono y no se envían a Convex.</Text>
        </View>
      )}
      {busy && !cameraVisible ? <ActivityIndicator style={styles.loader} size="large" color="#2563EB" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, alignItems: "center", backgroundColor: "#F4F7FB" },
  title: { width: "100%", maxWidth: 720, fontSize: 25, fontWeight: "800", color: "#172033" },
  help: { width: "100%", maxWidth: 720, marginTop: 8, color: "#667085", lineHeight: 21 },
  actionRow: { width: "100%", maxWidth: 720, flexDirection: "row", gap: 10, marginTop: 18 },
  primaryButton: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: "#2563EB", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  saveButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#93C5FD", backgroundColor: "#FFFFFF", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  saveButtonText: { color: "#1D4ED8", fontWeight: "700" },
  disabled: { opacity: 0.45 },
  overlapCard: { width: "100%", maxWidth: 720, marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: "#FFFFFF" },
  overlapTitle: { fontWeight: "700", color: "#172033" },
  note: { color: "#667085", lineHeight: 19 },
  previewHeader: { width: "100%", maxWidth: 720, marginTop: 20, marginBottom: 10, flexDirection: "row", justifyContent: "space-between" },
  previewTitle: { fontWeight: "700", color: "#172033" },
  removeText: { color: "#DC2626", fontWeight: "600" },
  composition: { backgroundColor: "#FFFFFF" },
  empty: { width: "100%", maxWidth: 720, marginTop: 28, padding: 28, alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: "#FFFFFF" },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#334155" },
  loader: { marginTop: 18 },
  cameraScreen: { flex: 1, backgroundColor: "#000000" },
  alignmentGuide: { position: "absolute", left: 18, right: 18, bottom: 120, height: "35%", borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.9)", backgroundColor: "rgba(37,99,235,0.16)", justifyContent: "center", alignItems: "center", padding: 12 },
  alignmentText: { color: "#FFFFFF", textAlign: "center", fontWeight: "700", textShadowColor: "#000000", textShadowRadius: 3 },
  cameraControls: { position: "absolute", left: 20, right: 20, bottom: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cameraButtonSecondary: { width: 90, paddingVertical: 12, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center" },
  cameraButtonText: { color: "#FFFFFF", fontWeight: "700" },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#FFFFFF" },
  cameraSpacer: { width: 90 },
});
