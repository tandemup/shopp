import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAction } from "convex/react";

import { api } from "@/convex/_generated/api";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const COLORS = {
  background: "#F4F7FB",
  surface: "#FFFFFF",
  text: "#172033",
  muted: "#667085",
  border: "#DDE3EC",
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primarySoft: "#EAF2FF",
  green: "#15803D",
  greenSoft: "#ECFDF3",
  red: "#B42318",
};

export default function EnglishTutorScreen() {
  const correctDescription = useAction(api.englishTutor.correctDescription);
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const handleCorrect = useCallback(async () => {
    const text = description.trim();
    const photo = imageUrl.trim();

    if (!photo || !text) {
      safeAlert(
        "Faltan datos",
        "Añade la URL de una fotografía y escribe una descripción en inglés.",
      );
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await correctDescription({ imageUrl: photo, text });
      setResult(response);
    } catch (error) {
      console.error("[EnglishTutorScreen] correction failed", error);
      safeAlert(
        "No se pudo corregir",
        error?.message || "Comprueba la conexión e inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }, [correctDescription, description, imageUrl]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="language-outline" size={25} color={COLORS.primary} />
          </View>
          <View style={styles.introText}>
            <Text style={styles.title}>Describe una fotografía</Text>
            <Text style={styles.subtitle}>
              Escribe varias frases en inglés y recibe correcciones explicadas en español.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>URL de la fotografía</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={(value) => {
            setImageUrl(value);
            setImageFailed(false);
          }}
          placeholder="https://ejemplo.com/fotografia.jpg"
          placeholderTextColor="#98A2B3"
          style={styles.input}
          value={imageUrl}
        />

        {imageUrl.trim() && !imageFailed ? (
          <Image
            onError={() => setImageFailed(true)}
            resizeMode="cover"
            source={{ uri: imageUrl.trim() }}
            style={styles.photo}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="image-outline" size={42} color="#98A2B3" />
            <Text style={styles.placeholderText}>
              {imageFailed ? "No se pudo cargar la fotografía" : "La fotografía aparecerá aquí"}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Tu descripción en inglés</Text>
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="In this photo, I can see..."
          placeholderTextColor="#98A2B3"
          style={[styles.input, styles.descriptionInput]}
          textAlignVertical="top"
          value={description}
        />

        <Pressable
          disabled={loading}
          onPress={handleCorrect}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={21} color="#FFFFFF" />
          )}
          <Text style={styles.buttonText}>{loading ? "Corrigiendo…" : "Corregir mi inglés"}</Text>
        </Pressable>

        {result ? (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>Corrección</Text>
            <View style={styles.correctedBox}>
              <Text style={styles.correctedText}>{result.correctedText}</Text>
            </View>

            {result.corrections?.map((correction, index) => (
              <View key={`${correction.original}-${index}`} style={styles.correctionCard}>
                <Text style={styles.originalText}>{correction.original}</Text>
                <Text style={styles.arrow}>↓</Text>
                <Text style={styles.replacementText}>{correction.corrected}</Text>
                <Text style={styles.explanation}>{correction.explanation}</Text>
              </View>
            ))}

            {result.vocabulary?.length ? (
              <View style={styles.vocabularyRow}>
                {result.vocabulary.map((word) => (
                  <View key={word} style={styles.vocabularyPill}>
                    <Text style={styles.vocabularyText}>{word}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {result.nextQuestion ? (
              <View style={styles.questionBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} />
                <Text style={styles.questionText}>{result.nextQuestion}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", padding: 16, paddingBottom: 48 },
  intro: { flexDirection: "row", padding: 16, backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border },
  introIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primarySoft, borderRadius: 15 },
  introText: { flex: 1, marginLeft: 13 },
  title: { color: COLORS.text, fontSize: 19, fontWeight: "800" },
  subtitle: { marginTop: 4, color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  label: { marginTop: 20, marginBottom: 7, color: COLORS.text, fontSize: 13, fontWeight: "700" },
  input: { minHeight: 50, paddingHorizontal: 14, color: COLORS.text, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, fontSize: 15 },
  photo: { width: "100%", height: 260, marginTop: 12, backgroundColor: "#E4E7EC", borderRadius: 18 },
  photoPlaceholder: { height: 220, marginTop: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.border, borderRadius: 18 },
  placeholderText: { marginTop: 9, color: COLORS.muted, fontSize: 13 },
  descriptionInput: { minHeight: 135, paddingTop: 13, paddingBottom: 13 },
  button: { minHeight: 50, marginTop: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, borderRadius: 14 },
  buttonPressed: { backgroundColor: COLORS.primaryDark },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  results: { marginTop: 24 },
  resultsTitle: { color: COLORS.text, fontSize: 19, fontWeight: "800" },
  correctedBox: { marginTop: 10, padding: 16, backgroundColor: COLORS.greenSoft, borderRadius: 15 },
  correctedText: { color: COLORS.green, fontSize: 16, lineHeight: 24, fontWeight: "700" },
  correctionCard: { marginTop: 10, padding: 15, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15 },
  originalText: { color: COLORS.red, fontSize: 14, textDecorationLine: "line-through" },
  arrow: { marginVertical: 3, color: COLORS.muted },
  replacementText: { color: COLORS.green, fontSize: 15, fontWeight: "700" },
  explanation: { marginTop: 8, color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  vocabularyRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  vocabularyPill: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.primarySoft, borderRadius: 20 },
  vocabularyText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: "700" },
  questionBox: { marginTop: 14, padding: 14, flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15 },
  questionText: { flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
