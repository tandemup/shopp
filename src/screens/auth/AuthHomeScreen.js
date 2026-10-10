import React, { useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { I18nText as Text } from "@/src/i18n";

const FEATURES = [
  {
    title: "Lista de la compra",
    description: "Organiza productos, cantidades, precios, ofertas y compras archivadas.",
  },
  {
    title: "Escáner",
    description: "Lee códigos de barras y códigos QR para acceder rápidamente a contenido.",
  },
  {
    title: "Música",
    description: "Crea playlists, reproduce canciones y comparte colecciones mediante Shopp.",
  },
  {
    title: "Biblioteca",
    description: "Guarda noticias, enlaces y recursos en una biblioteca privada organizada por categorías.",
  },
  {
    title: "Intercambio P2P",
    description: "Conecta dispositivos y usuarios para intercambiar contenido seleccionado.",
  },
  {
    title: "Tiendas",
    description: "Mantén tus supermercados y tiendas habituales disponibles desde la aplicación.",
  },
];

const STEPS = [
  {
    number: "1",
    title: "Accede a Shopp",
    description: "Entra con tu cuenta o crea una nueva para empezar a utilizar la aplicación.",
  },
  {
    number: "2",
    title: "Elige tus utilidades",
    description: "Usa compras, escáner, música, Biblioteca, P2P y las demás herramientas disponibles.",
  },
  {
    number: "3",
    title: "Trabaja desde tus dispositivos",
    description: "Utiliza Shopp desde móvil, tablet o escritorio con una interfaz adaptable.",
  },
];

export default function AuthHomeScreen({
  navigation,
  isAuthenticated = false,
  onAuthenticatedContinue,
  onGuestContinue,
}) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const narrow = width < 480;

  const scrollRef = useRef(null);
  const sectionOffsets = useRef({ inicio: 0, caracteristicas: 0, funcionamiento: 0 });
  const [menuOpen, setMenuOpen] = useState(false);

  const rememberSection = (key) => (event) => {
    sectionOffsets.current[key] = event.nativeEvent.layout.y;
  };

  const scrollToSection = (key) => {
    setMenuOpen(false);
    scrollRef.current?.scrollTo?.({
      y: Math.max(0, (sectionOffsets.current[key] || 0) - 8),
      animated: true,
    });
  };

  const handleEnter = () => {
    if (isAuthenticated && onAuthenticatedContinue) {
      onAuthenticatedContinue();
      return;
    }

    navigation.navigate("Login");
  };

  const renderMenuLinks = (mobile = false) => (
    <View style={mobile ? styles.mobileMenuLinks : styles.menuLinks}>
      <Pressable
        style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
        onPress={() => scrollToSection("inicio")}
      >
        <Text style={styles.menuText}>Inicio</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
        onPress={() => scrollToSection("caracteristicas")}
      >
        <Text style={styles.menuText}>Características</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
        onPress={() => scrollToSection("funcionamiento")}
      >
        <Text style={styles.menuText}>Cómo funciona</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <Pressable
          style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
          onPress={() => scrollToSection("inicio")}
        >
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>S</Text>
          </View>
          <Text style={styles.logo}>Shopp</Text>
        </Pressable>

        {!compact ? renderMenuLinks(false) : null}

        <View style={styles.actions}>
          {compact ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir menú"
              style={({ pressed }) => [styles.menuToggle, pressed && styles.pressed]}
              onPress={() => setMenuOpen((current) => !current)}
            >
              <Text style={styles.menuToggleText}>{menuOpen ? "×" : "☰"}</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              narrow && styles.compactActionButton,
              pressed && styles.pressed,
            ]}
            onPress={handleEnter}
          >
            <Text style={styles.loginText}>Entrar</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.registerButton,
              narrow && styles.compactActionButton,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.registerText}>{narrow ? "Cuenta" : "Crear cuenta"}</Text>
          </Pressable>
        </View>
      </View>

      {compact && menuOpen ? (
        <View style={styles.mobileMenu}>{renderMenuLinks(true)}</View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View onLayout={rememberSection("inicio")} style={styles.heroSection}>
          <View style={styles.contentWidth}>
            <View style={[styles.heroGrid, compact && styles.heroGridCompact]}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>SHOPP</Text>
                <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
                  Tu caja de herramientas cotidiana
                </Text>
                <Text style={styles.heroText}>
                  Compras, música, enlaces, escáner y herramientas de intercambio en una
                  única aplicación preparada para móvil, tablet y escritorio.
                </Text>

                <View style={[styles.heroActions, narrow && styles.heroActionsNarrow]}>
                  <Pressable
                    style={({ pressed }) => [styles.heroPrimary, pressed && styles.pressed]}
                    onPress={() => navigation.navigate("Register")}
                  >
                    <Text style={styles.heroPrimaryText}>Crear cuenta</Text>
                  </Pressable>

                  {onGuestContinue ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Continuar como invitado"
                      style={({ pressed }) => [styles.heroGuest, pressed && styles.pressed]}
                      onPress={onGuestContinue}
                    >
                      <Text style={styles.heroGuestText}>Continuar como invitado</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={({ pressed }) => [styles.heroSecondary, pressed && styles.pressed]}
                    onPress={() => scrollToSection("caracteristicas")}
                  >
                    <Text style={styles.heroSecondaryText}>Ver características</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.heroPanel}>
                <Text style={styles.heroPanelTitle}>Una aplicación, varias utilidades</Text>
                <View style={styles.heroPanelList}>
                  <Text style={styles.heroPanelItem}>• Listas y compras</Text>
                  <Text style={styles.heroPanelItem}>• Música y playlists</Text>
                  <Text style={styles.heroPanelItem}>• Biblioteca privada</Text>
                  <Text style={styles.heroPanelItem}>• Escáner QR y códigos de barras</Text>
                  <Text style={styles.heroPanelItem}>• Intercambio P2P</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View onLayout={rememberSection("caracteristicas")} style={styles.sectionAlt}>
          <View style={styles.contentWidth}>
            <Text style={styles.sectionEyebrow}>CARACTERÍSTICAS</Text>
            <Text style={styles.sectionTitle}>Herramientas disponibles en Shopp</Text>
            <Text style={styles.sectionIntro}>
              Cada utilidad puede evolucionar de forma independiente manteniendo una experiencia
              común dentro de la aplicación.
            </Text>

            <View style={styles.featureGrid}>
              {FEATURES.map((feature) => (
                <View key={feature.title} style={styles.featureCard}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View onLayout={rememberSection("funcionamiento")} style={styles.section}>
          <View style={styles.contentWidth}>
            <Text style={styles.sectionEyebrow}>CÓMO FUNCIONA</Text>
            <Text style={styles.sectionTitle}>Empieza en tres pasos</Text>

            <View style={styles.stepsGrid}>
              {STEPS.map((step) => (
                <View key={step.number} style={styles.stepCard}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step.number}</Text>
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              ))}
            </View>

            <View style={styles.finalCta}>
              <Text style={styles.finalCtaTitle}>¿Quieres entrar en Shopp?</Text>
              <Text style={styles.finalCtaText}>
                Accede con tu cuenta actual o crea una nueva para comenzar.
              </Text>
              <View style={[styles.heroActions, narrow && styles.heroActionsNarrow]}>
                <Pressable
                  style={({ pressed }) => [styles.heroPrimary, pressed && styles.pressed]}
                  onPress={handleEnter}
                >
                  <Text style={styles.heroPrimaryText}>Entrar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.heroSecondary, pressed && styles.pressed]}
                  onPress={() => navigation.navigate("Register")}
                >
                  <Text style={styles.heroSecondaryText}>Crear cuenta</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Shopp</Text>
          <Text style={styles.footerText}>Tu caja de herramientas cotidiana.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    width: "100%",
    minHeight: 72,
    paddingHorizontal: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    zIndex: 20,
    ...Platform.select({
      web: { boxShadow: "0 1px 8px rgba(15, 23, 42, 0.04)" },
      default: {},
    }),
  },
  headerCompact: {
    minHeight: 64,
    paddingHorizontal: 14,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
  },
  logo: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  menuLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  menuText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  menuToggle: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  menuToggleText: {
    fontSize: 22,
    lineHeight: 24,
    color: "#334155",
    fontWeight: "700",
  },
  mobileMenu: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 19,
  },
  mobileMenuLinks: {
    width: "100%",
  },
  loginButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#ffffff",
  },
  compactActionButton: {
    paddingHorizontal: 12,
  },
  loginText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "800",
  },
  registerButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#2563eb",
  },
  registerText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.78,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentWidth: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: 24,
  },
  heroSection: {
    paddingVertical: 76,
    backgroundColor: "#ffffff",
  },
  heroGrid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 64,
  },
  heroGridCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 36,
  },
  heroCopy: {
    flex: 1,
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  heroTitle: {
    color: "#0f172a",
    fontSize: 52,
    lineHeight: 60,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  heroTitleCompact: {
    fontSize: 38,
    lineHeight: 45,
  },
  heroText: {
    marginTop: 20,
    color: "#475569",
    fontSize: 18,
    lineHeight: 29,
    maxWidth: 680,
  },
  heroActions: {
    marginTop: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroActionsNarrow: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  heroPrimary: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 11,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  heroPrimaryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  heroGuest: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  heroGuestText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  heroSecondary: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  heroSecondaryText: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "800",
  },
  heroPanel: {
    flex: 0.72,
    minWidth: 280,
    padding: 28,
    borderRadius: 22,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroPanelTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 18,
  },
  heroPanelList: {
    gap: 13,
  },
  heroPanelItem: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  section: {
    paddingVertical: 76,
    backgroundColor: "#ffffff",
  },
  sectionAlt: {
    paddingVertical: 76,
    backgroundColor: "#f8fafc",
  },
  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  sectionIntro: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 760,
  },
  featureGrid: {
    marginTop: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  featureCard: {
    flexGrow: 1,
    flexBasis: 320,
    minWidth: 250,
    padding: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
  },
  featureTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "900",
  },
  featureDescription: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 22,
  },
  stepsGrid: {
    marginTop: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
  },
  stepCard: {
    flexGrow: 1,
    flexBasis: 290,
    minWidth: 240,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    backgroundColor: "#ffffff",
  },
  stepNumber: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
    marginBottom: 18,
  },
  stepNumberText: {
    color: "#1d4ed8",
    fontSize: 16,
    fontWeight: "900",
  },
  stepTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  stepDescription: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 22,
  },
  finalCta: {
    marginTop: 52,
    padding: 30,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
  },
  finalCtaTitle: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "900",
  },
  finalCtaText: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 15,
    lineHeight: 23,
  },
  footer: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  footerBrand: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  footerText: {
    marginTop: 5,
    color: "#94a3b8",
    fontSize: 13,
  },
});
