import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View
} from "react-native";
import { I18nText as Text, useI18n } from "@/src/i18n";

import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const FEATURE_OPTIONS = [
  { key: "scanner", label: "Escáner", icon: "barcode-outline" },
  { key: "stores", label: "Tiendas", icon: "storefront-outline" },
  { key: "chat", label: "Chat", icon: "chatbubble-ellipses-outline" },
  { key: "parking", label: "Aparcamiento", icon: "car-outline" },
  { key: "englishTutor", label: "Tutor de inglés", icon: "language-outline" },
  { key: "library", label: "Biblioteca", icon: "library-outline" },
  { key: "musicPlaylist", label: "Lista de música", icon: "musical-notes-outline" },
  { key: "classicalMusic", label: "Lista de música clásica", icon: "musical-notes-outline" },
  { key: "tutorials", label: "Tutoriales", icon: "school-outline" },
  { key: "news", label: "Noticias", icon: "newspaper-outline" },
  { key: "shoppLive", label: "Shopp en directo", icon: "radio-outline" },
  { key: "fireAlarm", label: "Alarma de incendios", icon: "flame-outline" },
  { key: "investments", label: "Inversiones", icon: "trending-up-outline" },
];

const emptyPermissions = () =>
  Object.fromEntries(FEATURE_OPTIONS.map(({ key }) => [key, false]));

function UserCard({ user, busy, onChangeRole, onChangeBlocked, onManagePermissions }) {
  const isAdmin = user.role === "admin";
  const isBlocked = user.status === "blocked";
  const label = user.email || user.name || String(user._id);

  return (
    <View style={styles.card}>
      <View style={styles.userIcon}>
        <Ionicons
          name={isAdmin ? "shield-checkmark" : "person-outline"}
          size={23}
          color={isAdmin ? "#15803d" : "#475569"}
        />
      </View>

      <View style={styles.userDetails}>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {label}
          </Text>
          {user.name && user.email ? (
            <Text style={styles.userEmail} numberOfLines={1}>
              {user.name}
            </Text>
          ) : null}
          <Text style={styles.userId} numberOfLines={1}>
            {String(user._id)}
          </Text>
          {isBlocked ? <Text style={styles.blockText}>Bloqueado</Text> : null}
        </View>

        <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onChangeRole(user)}
          style={({ pressed }) => [
            styles.roleButton,
            isAdmin ? styles.adminButton : styles.userButton,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <Text style={isAdmin ? styles.adminText : styles.userText}>
              {isAdmin ? "Admin" : "Usuario"}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onChangeBlocked(user)}
          style={({ pressed }) => [styles.roleButton, isBlocked ? styles.adminButton : styles.blockButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          <Text style={isBlocked ? styles.adminText : styles.blockText}>
            {isBlocked ? "Desbloquear" : "Bloquear"}
          </Text>
        </Pressable>
        {!isAdmin ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onManagePermissions(user)}
            style={({ pressed }) => [styles.permissionsButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.permissionsButtonText}>Utilidades</Text>
          </Pressable>
        ) : null}
        </View>
      </View>
    </View>
  );
}

export default function AdminUsersScreen() {
  const { t } = useI18n();
  const currentUser = useQuery(api.users.current);
  const users = useQuery(
    api.users.listForAdmin,
    currentUser?.isAdmin ? {} : "skip",
  );
  const setRole = useMutation(api.users.setRole);
  const setBlocked = useMutation(api.users.setBlocked);
  const setPermissions = useMutation(api.users.setPermissions);
  const [busyUserId, setBusyUserId] = useState(null);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [draftPermissions, setDraftPermissions] = useState(emptyPermissions);

  const changeRole = (user) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    const label = user.email || user.name || "este usuario";

    safeAlert(
      t(nextRole === "admin" ? "Conceder permisos" : "Retirar permisos"),
      nextRole === "admin"
        ? t(`¿Quieres convertir a ${label} en administrador?`)
        : t(`¿Quieres convertir a ${label} en usuario normal?`),
      [
        { text: t("Cancelar"), style: "cancel" },
        {
          text: t("Confirmar"),
          onPress: async () => {
            try {
              setBusyUserId(user._id);
              await setRole({ userId: user._id, role: nextRole });
            } catch (error) {
              safeAlert(
                t("No se pudo cambiar el rol"),
                error?.message || t("Se ha producido un error."),
              );
            } finally {
              setBusyUserId(null);
            }
          },
        },
      ],
    );
  };

  const changeBlocked = (user) => {
    const blocked = user.status !== "blocked";
    const label = user.email || user.name || "este usuario";
    safeAlert(
      t(blocked ? "Bloquear usuario" : "Desbloquear usuario"),
      blocked ? t(`¿Quieres bloquear a ${label}?`) : t(`¿Quieres desbloquear a ${label}?`),
      [
        { text: t("Cancelar"), style: "cancel" },
        {
          text: t("Confirmar"),
          onPress: async () => {
            try {
              setBusyUserId(user._id);
              await setBlocked({ userId: user._id, blocked });
            } catch (error) {
              safeAlert(t("No se pudo actualizar el estado"), error?.message || t("Se ha producido un error."));
            } finally {
              setBusyUserId(null);
            }
          },
        },
      ],
    );
  };

  const openPermissions = (user) => {
    setPermissionsUser(user);
    setDraftPermissions({ ...emptyPermissions(), ...(user.permissions || {}) });
  };

  const savePermissions = async () => {
    if (!permissionsUser) return;

    try {
      setBusyUserId(permissionsUser._id);
      await setPermissions({
        userId: permissionsUser._id,
        permissions: draftPermissions,
      });
      setPermissionsUser(null);
    } catch (error) {
      safeAlert(
        t("No se pudieron guardar las utilidades"),
        error?.message || t("Se ha producido un error."),
      );
    } finally {
      setBusyUserId(null);
    }
  };

  if (currentUser === undefined || (currentUser?.isAdmin && users === undefined)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Cargando usuarios...</Text>
      </View>
    );
  }

  if (!currentUser?.isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={42} color="#dc2626" />
        <Text style={styles.deniedTitle}>Acceso restringido</Text>
        <Text style={styles.deniedText}>
          Esta pantalla solo está disponible para administradores.
        </Text>
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Usuarios registrados</Text>
        <Text style={styles.summaryText}>
          {users.length} {users.length === 1 ? "usuario" : "usuarios"}
        </Text>
      </View>

      {users.map((user) => (
        <UserCard
          key={user._id}
          user={user}
          busy={busyUserId === user._id}
          onChangeRole={changeRole}
          onChangeBlocked={changeBlocked}
          onManagePermissions={openPermissions}
        />
      ))}
    </ScrollView>
    <Modal
      visible={Boolean(permissionsUser)}
      transparent
      animationType="slide"
      onRequestClose={() => setPermissionsUser(null)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Utilidades permitidas</Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {permissionsUser?.email || permissionsUser?.name || "Usuario"}
              </Text>
            </View>
            <Pressable onPress={() => setPermissionsUser(null)} hitSlop={10}>
              <Ionicons name="close" size={24} color="#475569" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.permissionsList}>
            {FEATURE_OPTIONS.map(({ key, label, icon }) => (
              <View key={key} style={styles.permissionRow}>
                <View style={styles.permissionIcon}>
                  <Ionicons name={icon} size={19} color="#2563eb" />
                </View>
                <Text style={styles.permissionLabel}>{label}</Text>
                <Switch
                  value={draftPermissions[key] === true}
                  onValueChange={(value) => setDraftPermissions((current) => ({ ...current, [key]: value }))}
                  trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
                  thumbColor={draftPermissions[key] ? "#2563eb" : "#f8fafc"}
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable onPress={() => setPermissionsUser(null)} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={savePermissions}
              disabled={busyUserId === permissionsUser?._id}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, busyUserId === permissionsUser?._id && styles.disabled]}
            >
              <Text style={styles.saveButtonText}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  loadingText: { marginTop: 12, color: "#64748b" },
  deniedTitle: { marginTop: 12, fontSize: 20, fontWeight: "800", color: "#0f172a" },
  deniedText: { marginTop: 6, textAlign: "center", color: "#64748b" },
  summary: {
    marginBottom: 4,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#dbeafe",
  },
  summaryTitle: { fontSize: 18, fontWeight: "800", color: "#1e3a8a" },
  summaryText: { marginTop: 3, color: "#1d4ed8" },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  userIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  userDetails: { flex: 1, minWidth: 0 },
  userInfo: { minWidth: 0 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 },
  userName: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  userEmail: { marginTop: 2, fontSize: 13, color: "#475569" },
  userId: { marginTop: 3, fontSize: 11, color: "#94a3b8" },
  roleButton: {
    minWidth: 76,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 999,
  },
  adminButton: { borderColor: "#86efac", backgroundColor: "#dcfce7" },
  userButton: { borderColor: "#cbd5e1", backgroundColor: "#f8fafc" },
  blockButton: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  permissionsButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 999,
    backgroundColor: "#eff6ff",
  },
  permissionsButtonText: { fontSize: 12, fontWeight: "800", color: "#1d4ed8" },
  blockText: { fontWeight: "700", color: "#b91c1c" },
  adminText: { fontWeight: "800", color: "#15803d" },
  userText: { fontWeight: "700", color: "#475569" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "82%",
    padding: 20,
    paddingBottom: 24,
    borderRadius: 24,
    backgroundColor: "#ffffff",
  },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  modalHeading: { flex: 1 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  modalSubtitle: { marginTop: 4, color: "#64748b" },
  permissionsList: { gap: 8, paddingBottom: 12 },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
  },
  permissionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
  },
  permissionLabel: { flex: 1, fontWeight: "700", color: "#1e293b" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  cancelButton: { minHeight: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { fontWeight: "700", color: "#475569" },
  saveButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#2563eb",
  },
  saveButtonText: { fontWeight: "800", color: "#ffffff" },
});
