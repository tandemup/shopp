import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

const FEATURES = [
  {
    icon: "cart-outline",
    color: "#2563eb",
    background: "#eff6ff",
    title: "Lista de la compra",
    description: "Organiza productos, cantidades, precios y ofertas.",
  },
  {
    icon: "barcode-outline",
    color: "#0f766e",
    background: "#ecfdf5",
    title: "Escáner e historial",
    description: "Lee códigos de barras y consulta tus productos.",
  },
  {
    icon: "storefront-outline",
    color: "#b45309",
    background: "#fffbeb",
    title: "Tiendas",
    description: "Guarda tus supermercados y tus preferencias.",
  },
  {
    icon: "musical-notes-outline",
    color: "#7c3aed",
    background: "#f5f3ff",
    title: "Playlists",
    description: "Crea colecciones musicales para escuchar y compartir.",
  },
];

const QUESTIONS = [
  {
    id: "interest",
    title: "¿Qué te interesa más?",
    options: ["Organizar mis compras", "Escanear productos", "Crear playlists"],
  },
  {
    id: "frequency",
    title: "¿Con qué frecuencia haces la compra?",
    options: ["Varias veces por semana", "Una vez por semana", "Cuando lo necesito"],
  },
  {
    id: "use",
    title: "¿Cómo quieres usar Shopp?",
    options: ["Solo yo", "Con mi familia", "Aún lo estoy probando"],
  },
];

export default function WelcomeSurveyScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const [answers, setAnswers] = useState({});
  const isDesktop = width >= 860;
  const answeredCount = Object.keys(answers).length;
  const canContinue = answeredCount === QUESTIONS.length;

  const progressText = useMemo(
    () => `${answeredCount} de ${QUESTIONS.length} respondidas`,
    [answeredCount]
  );

  const continueToAccess = () => navigation.replace("AuthHome");

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          isDesktop && styles.contentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="sparkles" size={19} color="#ffffff" />
            </View>
            <Text style={styles.brand}>Shopp</Text>
          </View>

          <Text style={styles.title}>Tu caja de herramientas cotidiana</Text>
          <Text style={styles.subtitle}>
            Compras más claras, productos a mano y música organizada. Descubre
            lo que puedes hacer antes de crear tu cuenta.
          </Text>

          <View style={styles.featureGrid}>
            {FEATURES.map((feature) => (
              <View key={feature.title} style={styles.featureCard}>
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: feature.background },
                  ]}
                >
                  <Ionicons name={feature.icon} size={22} color={feature.color} />
                </View>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.surveyCard, isDesktop && styles.surveyCardDesktop]}>
          <View style={styles.surveyHeader}>
            <View>
              <Text style={styles.surveyTitle}>Personaliza tu bienvenida</Text>
              <Text style={styles.surveySubtitle}>
                Tres preguntas rápidas y opcionales.
              </Text>
            </View>
            <Text style={styles.progressText}>{progressText}</Text>
          </View>

          {QUESTIONS.map((question, index) => (
            <View
              key={question.id}
              style={[
                styles.question,
                index === QUESTIONS.length - 1 && styles.questionLast,
              ]}
            >
              <Text style={styles.questionTitle}>{question.title}</Text>
              <View style={styles.options}>
                {question.options.map((option) => {
                  const selected = answers[question.id] === option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: option,
                        }))
                      }
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.radio,
                          selected && styles.radioSelected,
                        ]}
                      >
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <Pressable
            accessibilityRole="button"
            onPress={continueToAccess}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {canContinue ? "Ver mi experiencia Shopp" : "Continuar sin responder"}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          </Pressable>

          <Text style={styles.privacyNote}>
            Tus respuestas no se envían ni se guardan. Esta encuesta solo sirve
            para presentarte Shopp.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.select({ ios: 12, default: 24 }),
    paddingBottom: 32,
    gap: 20,
  },
  contentDesktop: {
    maxWidth: 1180,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 48,
    gap: 48,
  },
  hero: { width: "100%" },
  heroDesktop: { flex: 1, maxWidth: 570 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 20 },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  brand: { color: "#0f172a", fontSize: 21, fontWeight: "900", letterSpacing: -0.3 },
  title: {
    color: "#0f172a",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -0.75,
  },
  subtitle: { marginTop: 12, color: "#475569", fontSize: 16, lineHeight: 24 },
  featureGrid: { marginTop: 28, gap: 12 },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
  },
  featureIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  featureCopy: { flex: 1 },
  featureTitle: { color: "#1e293b", fontSize: 15, fontWeight: "800" },
  featureDescription: { marginTop: 3, color: "#64748b", fontSize: 13, lineHeight: 18 },
  surveyCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#dbeafe",
    shadowColor: "#0f172a",
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  surveyCardDesktop: { width: 470, padding: 28 },
  surveyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  surveyTitle: { color: "#0f172a", fontSize: 21, fontWeight: "900", letterSpacing: -0.35 },
  surveySubtitle: { marginTop: 4, color: "#64748b", fontSize: 13, lineHeight: 18 },
  progressText: {
    color: "#1d4ed8",
    backgroundColor: "#eff6ff",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    textAlign: "center",
  },
  question: { paddingBottom: 18, marginBottom: 18, borderBottomWidth: 1, borderColor: "#edf2f7" },
  questionLast: { marginBottom: 22 },
  questionTitle: { color: "#334155", fontSize: 15, lineHeight: 20, fontWeight: "800", marginBottom: 10 },
  options: { gap: 8 },
  option: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  optionSelected: { backgroundColor: "#eff6ff", borderColor: "#60a5fa" },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioSelected: { borderColor: "#2563eb" },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2563eb" },
  optionText: { flex: 1, color: "#475569", fontSize: 14, fontWeight: "600" },
  optionTextSelected: { color: "#1d4ed8", fontWeight: "800" },
  primaryButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  privacyNote: { marginTop: 13, color: "#94a3b8", textAlign: "center", fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
});
