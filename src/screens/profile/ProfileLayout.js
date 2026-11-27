import React from "react";
import {
  Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import AvatarEditorScreen from "./AvatarEditorScreen";

export default function ProfileLayout({
  accountLabel, onBack, avatar, avatarAsset, avatarBusy, avatarNotice, includeAvatarBase64,
  onEditAvatar, onChooseAvatar, onTakeAvatarPhoto, onCloseAvatarEditor, onAvatarEdited, onRemoveAvatar, contentStyle, children,
}) {
  return (
    <>
      <Modal
        visible={Boolean(avatarAsset)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onCloseAvatarEditor}
      >
        {avatarAsset ? (
          <AvatarEditorScreen
            asset={avatarAsset}
            onCancel={onCloseAvatarEditor}
            onConfirm={onAvatarEdited}
            includeBase64={includeAvatarBase64}
          />
        ) : null}
      </Modal>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Volver a compras">
                <Ionicons name="arrow-back" size={22} color="#14532d" />
              </TouchableOpacity>
            ) : null}
            <View style={styles.headerIcon}>
              <Ionicons name="person-outline" size={25} color="#14532d" />
            </View>
            <View style={styles.headerTextBox}>
              <Text style={styles.title}>Mi perfil</Text>
              <Text style={styles.subtitle}>{accountLabel}</Text>
            </View>
          </View>

          <View style={styles.avatarCard}>
            <View style={styles.avatarCardTop}>
              <TouchableOpacity
                style={styles.avatar}
                onPress={onEditAvatar}
                disabled={avatarBusy}
                accessibilityLabel="Editar avatar"
              >
                {avatar?.uri ? (
                  <Image
                    source={{ uri: avatar.uri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons name="person" size={38} color="#14532d" />
                )}
              </TouchableOpacity>
              <View style={styles.avatarCardText}>
                <Text style={styles.avatarCardTitle}>Avatar actual</Text>
                {avatarNotice ? <Text accessibilityLiveRegion="polite" style={styles.avatarCardHelp}>{avatarNotice}</Text> : null}
              </View>
            </View>

            <View style={styles.avatarLinks}>
              <TouchableOpacity
                onPress={onEditAvatar}
                disabled={avatarBusy}
              >
                <Text style={styles.avatarActionText}>
                  {avatarBusy ? "Procesando…" : avatar?.uri ? "Editar" : "Elegir foto"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onTakeAvatarPhoto}
                disabled={avatarBusy}
              >
                <Text style={styles.avatarActionText}>Tomar foto</Text>
              </TouchableOpacity>
              {avatar?.uri && onChooseAvatar ? (
                <TouchableOpacity onPress={onChooseAvatar} disabled={avatarBusy}>
                  <Text style={styles.avatarActionText}>Elegir otra foto</Text>
                </TouchableOpacity>
              ) : null}
              {avatar?.uri ? (
                <TouchableOpacity
                  onPress={onRemoveAvatar}
                  disabled={avatarBusy}
                >
                  <Text style={styles.removeAvatarText}>Eliminar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  avatarCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarCardText: {
    flex: 1,
  },
  avatarCardTitle: {
    color: "#14532d",
    fontSize: 16,
    fontWeight: "900",
  },
  avatarCardHelp: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  avatarLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    marginTop: 16,
    marginLeft: 2,
  },
  avatarActionText: {
    color: "#15803d",
    fontWeight: "800",
  },
  removeAvatarText: {
    color: "#b91c1c",
    fontWeight: "800",
  },
  headerTextBox: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
  },
  noticeBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    color: "#166534",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  label: {
    fontSize: 14,
    fontWeight: "900",
    color: "#14532d",
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  help: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  helpNoMargin: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  switchRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  switchTextBox: {
    flex: 1,
  },
  switchTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#15803d",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
});
