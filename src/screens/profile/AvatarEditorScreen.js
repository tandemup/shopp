import React, { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { I18nText as Text } from "@/src/i18n";

import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";

const EDITOR_SIZE = 320;
const OUTPUT_SIZES = [64, 128, 256];
const OUTPUT_FORMATS = [
  {
    key: "jpeg",
    label: "JPEG",
    saveFormat: ImageManipulator.SaveFormat.JPEG,
    mimeType: "image/jpeg",
    extension: "jpg",
    compress: 0.78,
  },
  {
    key: "png",
    label: "PNG",
    saveFormat: ImageManipulator.SaveFormat.PNG,
    mimeType: "image/png",
    extension: "png",
    compress: 1,
  },
  {
    key: "webp",
    label: "WebP",
    saveFormat: ImageManipulator.SaveFormat.WEBP,
    mimeType: "image/webp",
    extension: "webp",
    compress: 0.82,
  },
].filter((format) => format.saveFormat);

export default function AvatarEditorScreen({ asset, onCancel, onConfirm }) {
  const width = asset?.width || 1;
  const height = asset?.height || 1;
  const baseScale = Math.max(EDITOR_SIZE / width, EDITOR_SIZE / height);
  const [zoom, setZoom] = useState(1);
  const [outputSize, setOutputSize] = useState(128);
  const outputFormat = "jpeg";
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  const startRef = useRef(offset);
  const zoomRef = useRef(zoom);
  const dimensionsRef = useRef({ width, height, baseScale });
  const sliderStartRef = useRef(140);
  const displayedRef = useRef(null);

  const displayed = useMemo(
    () => ({
      width: width * baseScale * zoom,
      height: height * baseScale * zoom,
    }),
    [width, height, baseScale, zoom],
  );
  displayedRef.current = displayed;
  dimensionsRef.current = { width, height, baseScale };

  const clampOffset = (
    next,
    currentDisplayed = displayedRef.current || displayed,
  ) => ({
    x: Math.min(
      Math.max(next.x, (EDITOR_SIZE - currentDisplayed.width) / 2),
      (currentDisplayed.width - EDITOR_SIZE) / 2,
    ),
    y: Math.min(
      Math.max(next.y, (EDITOR_SIZE - currentDisplayed.height) / 2),
      (currentDisplayed.height - EDITOR_SIZE) / 2,
    ),
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = offsetRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const currentDisplayed = displayedRef.current || displayed;
        const next = clampOffset(
          {
            x: startRef.current.x + gesture.dx,
            y: startRef.current.y + gesture.dy,
          },
          currentDisplayed,
        );
        offsetRef.current = next;
        setOffset(next);
      },
    }),
  ).current;

  const selectZoom = (value) => {
    zoomRef.current = value;
    setZoom(value);
    setOffset((current) => {
      const nextDisplayed = {
        width: width * baseScale * value,
        height: height * baseScale * value,
      };
      const next = {
        x: Math.min(
          Math.max(current.x, (EDITOR_SIZE - nextDisplayed.width) / 2),
          (nextDisplayed.width - EDITOR_SIZE) / 2,
        ),
        y: Math.min(
          Math.max(current.y, (EDITOR_SIZE - nextDisplayed.height) / 2),
          (nextDisplayed.height - EDITOR_SIZE) / 2,
        ),
      };
      offsetRef.current = next;
      startRef.current = next;
      return next;
    });
  };

  const zoomFromPosition = (x) => {
    const value = 0.5 + Math.max(0, Math.min(1, x / 280)) * 2.5;
    selectZoom(Math.round(value * 20) / 20);
  };

  const zoomSliderResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        sliderStartRef.current = ((zoomRef.current - 0.5) / 2.5) * 280;
      },
      onPanResponderMove: (_, gesture) => {
        zoomFromPosition(sliderStartRef.current + gesture.dx);
      },
    }),
  ).current;

  const confirm = async () => {
    const selectedFormat =
      OUTPUT_FORMATS.find((format) => format.key === outputFormat) ||
      OUTPUT_FORMATS[0];
    const scale = baseScale * zoom;
    const imageLeft = (EDITOR_SIZE - displayed.width) / 2 + offset.x;
    const imageTop = (EDITOR_SIZE - displayed.height) / 2 + offset.y;
    const crop = {
      originX: Math.max(0, Math.round(-imageLeft / scale)),
      originY: Math.max(0, Math.round(-imageTop / scale)),
      width: Math.min(width, Math.round(EDITOR_SIZE / scale)),
      height: Math.min(height, Math.round(EDITOR_SIZE / scale)),
    };
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ crop }, { resize: { width: outputSize, height: outputSize } }],
      { compress: selectedFormat.compress, format: selectedFormat.saveFormat },
    );
    onConfirm({
      ...asset,
      uri: result.uri,
      mimeType: selectedFormat.mimeType,
      fileName: `avatar.${selectedFormat.extension}`,
      width: outputSize,
      height: outputSize,
      outputSize,
      outputFormat: selectedFormat.label,
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onCancel} style={styles.topButton}>
          <Ionicons name="close" size={25} color="#fff" />
          <Text style={styles.topText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Editar avatar</Text>
        <TouchableOpacity onPress={confirm} style={styles.topButton}>
          <Text style={styles.topText}>Usar</Text>
          <Ionicons name="checkmark" size={25} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.helpBox}>
          <Text style={styles.sectionLabel}>Tamaño del avatar</Text>
          <View style={styles.sizeMenu}>
            {OUTPUT_SIZES.map((size) => {
              const selected = outputSize === size;
              return (
                <TouchableOpacity
                  key={size}
                  onPress={() => setOutputSize(size)}
                  style={[
                    styles.sizeButton,
                    selected && styles.sizeButtonSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.sizeText,
                      selected && styles.sizeTextSelected,
                    ]}
                  >
                    {size} px
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.zoomValue}>{Math.round(zoom * 100)}%</Text>
          <View style={styles.slider} {...zoomSliderResponder.panHandlers}>
            <View style={styles.sliderTrack} />
            <View
              style={[
                styles.sliderFill,
                { width: `${((zoom - 0.5) / 2.5) * 100}%` },
              ]}
            />
            <View
              style={[
                styles.sliderThumb,
                { left: `${((zoom - 0.5) / 2.5) * 100}%` },
              ]}
            />
          </View>
          <View style={styles.zoomScale}>
            <Text style={styles.zoomText}>50%</Text>
            <Text style={styles.zoomText}>300%</Text>
          </View>
        </View>
        <View style={styles.editor} {...panResponder.panHandlers}>
          <Image
            source={{ uri: asset.uri }}
            style={{
              position: "absolute",
              width: displayed.width,
              height: displayed.height,
              left: (EDITOR_SIZE - displayed.width) / 2 + offset.x,
              top: (EDITOR_SIZE - displayed.height) / 2 + offset.y,
            }}
          />
          <View pointerEvents="none" style={styles.cropFrame} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f172a", alignItems: "center" },
  content: { width: "100%" },
  contentContainer: { alignItems: "center", paddingBottom: 28 },
  topBar: {
    width: "100%",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 82,
  },
  topText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  title: { color: "#fff", fontSize: 18, fontWeight: "900" },
  helpBox: {
    width: EDITOR_SIZE,
    marginTop: 30,
    marginBottom: 8,
    alignItems: "center",
  },
  help: { color: "#cbd5e1", marginBottom: 10, textAlign: "center" },
  sizeMenu: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  sizeButton: {
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  sizeButtonSelected: { backgroundColor: "#166534", borderColor: "#4ade80" },
  sizeText: { color: "#cbd5e1", fontSize: 12, fontWeight: "800" },
  sizeTextSelected: { color: "#fff" },
  zoomValue: {
    color: "#4ade80",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  slider: {
    width: 280,
    height: 28,
    justifyContent: "center",
    position: "relative",
  },
  sliderTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#475569",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  sliderThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#22c55e",
  },
  zoomScale: {
    width: 280,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  zoomRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  zoomButton: {
    minWidth: 43,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  zoomButtonSelected: { backgroundColor: "#166534", borderColor: "#4ade80" },
  zoomText: { color: "#cbd5e1", fontSize: 11, fontWeight: "700" },
  zoomTextSelected: { color: "#fff" },
  editor: {
    width: EDITOR_SIZE,
    height: EDITOR_SIZE,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  cropFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "#fff",
  },
  sectionLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    maxWidth: 360,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e293b",
  },
  optionButtonSelected: { backgroundColor: "#166534", borderColor: "#4ade80" },
  optionText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  optionTextSelected: { color: "#fff" },
  outputInfo: {
    color: "#bbf7d0",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
});
