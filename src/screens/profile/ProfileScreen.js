import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
  Modal
} from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { storage } from "../../storage";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { getScannedHistory as getLocalScannedHistory } from "@/src/services/scannerHistory";
import { migrateLocalScannedHistory } from "@/src/services/scannedHistorySync";
import AvatarEditorScreen from "./AvatarEditorScreen";

function cleanText(value) {
  return String(value || "").trim();
}

function formatAccountLabel(currentUser) {
  if (!currentUser) return "Cuenta de Shopp";

  return (
    currentUser?.email ||
    currentUser?.name ||
    currentUser?._id ||
    "Cuenta de Shopp"
  );
}

function getAvatarStorageKey(currentUser) {
  const identity = currentUser?._id || currentUser?.email;
  return identity ? `shopp.avatar.${identity}` : null;
}

export default function ProfileScreen({ navigation }) {
  const currentUser = useQuery(api.users.current);
  const profile = useQuery(api.users.getMyProfile);
  const upsertMyProfile = useMutation(api.users.upsertMyProfile);
  const syncMyScannedEntry = useMutation(
    api.userScanHistory.syncMyScannedEntry,
  );
  const generateAvatarUploadUrl = useMutation(
    api.users.generateAvatarUploadUrl,
  );
  const setMyAvatar = useMutation(api.users.setMyAvatar);
  const removeMyAvatar = useMutation(api.users.removeMyAvatar);

  const [alias, setAlias] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [scanHistorySyncEnabled, setScanHistorySyncEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [localAvatar, setLocalAvatar] = useState(null);
  const [avatarAsset, setAvatarAsset] = useState(null);

  const accountLabel = useMemo(
    () => formatAccountLabel(currentUser),
    [currentUser],
  );

  useEffect(() => {
    let active = true;
    const loadLocalAvatar = async () => {
      const key = getAvatarStorageKey(currentUser);
      if (!key) {
        if (active) setLocalAvatar(null);
        return;
      }

      try {
        const storedAvatar = await storage.getFile(key);
        if (!storedAvatar) {
          if (active) setLocalAvatar(null);
          return;
        }
        const uri =
          storedAvatar.uri ||
          (storedAvatar.blob && URL.createObjectURL(storedAvatar.blob));
        if (active) setLocalAvatar({ ...(storedAvatar.metadata || {}), uri });
      } catch (error) {
        console.warn("[ProfileScreen] local avatar read error", error);
        if (active) setLocalAvatar(null);
      }
    };

    if (currentUser !== undefined) loadLocalAvatar();
    return () => {
      active = false;
    };
  }, [currentUser]);

  // La caché local se usa primero. Si no existe, descargamos el avatar de
  // Convex y guardamos una copia para las siguientes visitas.
  useEffect(() => {
    let active = true;
    const cacheRemoteAvatar = async () => {
      const remoteUrl = profile?.avatarUrl;
      const key = getAvatarStorageKey(currentUser);
      if (!remoteUrl || !key || localAvatar?.uri) return;

      try {
        const response = await fetch(remoteUrl);
        if (!response.ok) throw new Error("No se pudo descargar el avatar.");
        const blob = await response.blob();
        const metadata = {
          mimeType: blob.type || "image/png",
          fileName: "avatar.png",
          width: 128,
          height: 128,
          storageId: profile.avatarStorageId || null,
          updatedAt: Date.now(),
        };
        const saved = await storage.setFile(key, blob, metadata);
        const uri =
          saved?.uri ||
          (saved?.blob && URL.createObjectURL(saved.blob)) ||
          remoteUrl;
        if (active) setLocalAvatar({ ...metadata, uri });
      } catch (error) {
        console.warn("[ProfileScreen] remote avatar cache error", error);
        if (active) setLocalAvatar({ uri: remoteUrl, updatedAt: Date.now() });
      }
    };

    if (currentUser && profile !== undefined) cacheRemoteAvatar();
    return () => {
      active = false;
    };
  }, [currentUser, profile, localAvatar?.uri]);

  useEffect(() => {
    if (profile === undefined) return;
    if (formTouched) return;

    if (profile) {
      setAlias(profile.alias || "");
      setPhone(profile.phone || "");
      setPhoneVisible(profile.phoneVisible === true);
      setScanHistorySyncEnabled(profile.scanHistorySyncEnabled === true);
      return;
    }

    setAlias("");
    setPhone("");
    setPhoneVisible(false);
    setScanHistorySyncEnabled(false);
  }, [profile, formTouched]);

  const handleChangeAlias = (value) => {
    setFormTouched(true);
    setAlias(value);
  };

  const handleChangePhone = (value) => {
    setFormTouched(true);
    setPhone(value);
  };

  const handleChangePhoneVisible = (value) => {
    setFormTouched(true);
    setPhoneVisible(value);
  };

  const handleChangeScanHistorySync = (value) => {
    setFormTouched(true);
    setScanHistorySyncEnabled(value);
  };

  const handleChooseAvatar = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        safeAlert(
          "Permiso necesario",
          "Autoriza el acceso a tus fotos para elegir un avatar.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) return;
      setAvatarAsset(result.assets[0]);
    } catch (error) {
      console.warn("[ProfileScreen] avatar picker error", error);
      safeAlert(
        "No se pudo seleccionar",
        error?.message || "Inténtalo de nuevo.",
      );
    }
  };

  // Edita el avatar ya guardado sin volver a abrir el selector de archivos.
  // Si todavía no existe, conserva el comportamiento de seleccionar una imagen.
  const handleEditAvatar = () => {
    if (localAvatar?.uri) {
      setAvatarAsset({
        uri: localAvatar.uri,
        width: localAvatar.width || 128,
        height: localAvatar.height || 128,
        mimeType: localAvatar.mimeType || "image/jpeg",
        fileName: localAvatar.fileName || "avatar.jpg",
      });
      return;
    }

    handleChooseAvatar();
  };

  const handleTakeAvatarPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        safeAlert(
          "Permiso necesario",
          "Autoriza el acceso a la cámara para tomar una foto de perfil.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) return;
      setAvatarAsset(result.assets[0]);
    } catch (error) {
      console.warn("[ProfileScreen] avatar camera error", error);
      safeAlert(
        "No se pudo abrir la cámara",
        error?.message || "Inténtalo de nuevo.",
      );
    }
  };

  const handleAvatarEdited = async (asset) => {
    setAvatarAsset(null);
    try {
      setAvatarBusy(true);
      const key = getAvatarStorageKey(currentUser);
      if (!key) throw new Error("No se ha identificado la cuenta.");

      const storedAvatar = {
        uri: asset.uri,
        mimeType: asset.mimeType || "image/jpeg",
        fileName: asset.fileName || "avatar.jpg",
        width: asset.width || 128,
        height: asset.height || 128,
        updatedAt: Date.now(),
      };
      const uploadUrl = await generateAvatarUploadUrl({});
      const fileResponse = await fetch(asset.uri);
      if (!fileResponse.ok) throw new Error("No se pudo leer la imagen.");
      const blob = await fileResponse.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": storedAvatar.mimeType },
        body: blob,
      });
      if (!uploadResponse.ok) {
        throw new Error("No se pudo subir el avatar a Convex.");
      }
      const { storageId } = await uploadResponse.json();
      await setMyAvatar({ storageId });

      // Guardamos el Blob, no solo la URL remota, para permitir el uso local.
      const saved = await storage.setFile(key, blob, {
        ...storedAvatar,
        storageId,
      });
      const uri =
        saved?.uri ||
        (saved?.blob && URL.createObjectURL(saved.blob)) ||
        asset.uri;
      setLocalAvatar({ ...storedAvatar, storageId, uri });
      safeAlert(
        "Avatar actualizado",
        "La imagen se ha guardado en Convex y se ha cacheado en este dispositivo.",
      );
    } catch (error) {
      console.warn("[ProfileScreen] avatar error", error);
      safeAlert(
        "No se pudo actualizar",
        error?.message || "Inténtalo de nuevo.",
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarBusy(true);
      const key = getAvatarStorageKey(currentUser);
      if (key) await storage.removeFile(key);
      await removeMyAvatar({});
      setLocalAvatar(null);
    } catch (error) {
      safeAlert("No se pudo eliminar", error?.message || "Inténtalo de nuevo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSave = async () => {
    const cleanAlias = cleanText(alias);
    const cleanPhone = cleanText(phone);

    if (cleanAlias.length < 2) {
      safeAlert(
        "Alias obligatorio",
        "Escribe un alias público de al menos 2 caracteres.",
      );
      return;
    }

    if (cleanAlias.length > 40) {
      safeAlert(
        "Alias demasiado largo",
        "El alias público no puede tener más de 40 caracteres.",
      );
      return;
    }

    if (cleanPhone.length > 30) {
      safeAlert(
        "Teléfono demasiado largo",
        "El teléfono no puede tener más de 30 caracteres.",
      );
      return;
    }

    try {
      setSaving(true);

      const enablingSync =
        scanHistorySyncEnabled && profile?.scanHistorySyncEnabled !== true;

      await upsertMyProfile({
        alias: cleanAlias,
        phone: cleanPhone || undefined,
        phoneVisible,
        scanHistorySyncEnabled,
      });

      if (enablingSync) {
        const localHistory = await getLocalScannedHistory();
        const migration = await migrateLocalScannedHistory({
          localItems: localHistory,
          uploadEntry: async (barcode, patch) => {
            await syncMyScannedEntry({ ...patch, barcode });
          },
          onUploadError: (error, item) => {
            console.warn(
              "[ProfileScreen] scanned history migration failed",
              item?.barcode,
              error,
            );
          },
        });

        if (migration.failed > 0) {
          safeAlert(
            "Sincronización parcial",
            `Se han subido ${migration.uploaded} productos. ${migration.failed} no se pudieron sincronizar y se reintentará más tarde.`,
          );
        }
      }

      setFormTouched(false);

      safeAlert(
        "Perfil actualizado",
        "Tu alias y tus preferencias de contacto se han guardado correctamente.",
      );

      navigation?.goBack?.();
    } catch (error) {
      console.warn("[ProfileScreen] save profile error", error);

      safeAlert(
        "No se pudo guardar",
        error?.message || "Revisa los datos e inténtalo de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (currentUser === undefined || profile === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <>
      <Modal
        visible={Boolean(avatarAsset)}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {avatarAsset ? (
          <AvatarEditorScreen
            asset={avatarAsset}
            onCancel={() => setAvatarAsset(null)}
            onConfirm={handleAvatarEdited}
          />
        ) : null}
      </Modal>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
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
                onPress={handleEditAvatar}
                disabled={avatarBusy}
                accessibilityLabel="Editar avatar"
              >
                {localAvatar?.uri ? (
                  <Image
                    source={{ uri: localAvatar.uri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons name="person" size={38} color="#14532d" />
                )}
              </TouchableOpacity>
              <View style={styles.avatarCardText}>
                <Text style={styles.avatarCardTitle}>Avatar actual</Text>
                <Text style={styles.avatarCardHelp}>
                  Usa una imagen cuadrada para obtener mejores resultados.
                </Text>
              </View>
            </View>

            <View style={styles.avatarLinks}>
              <TouchableOpacity
                onPress={handleEditAvatar}
                disabled={avatarBusy}
              >
                <Text style={styles.avatarActionText}>
                  {avatarBusy ? "Guardando..." : "Editar"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleTakeAvatarPhoto}
                disabled={avatarBusy}
              >
                <Text style={styles.avatarActionText}>Tomar foto</Text>
              </TouchableOpacity>
              {localAvatar?.uri ? (
                <TouchableOpacity
                  onPress={handleRemoveAvatar}
                  disabled={avatarBusy}
                >
                  <Text style={styles.removeAvatarText}>Eliminar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {profile ? null : (
            <View style={styles.noticeBox}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#166534"
              />
              <Text style={styles.noticeText}>
                Esta cuenta todavía no tiene perfil. Completa un alias público
                para usar Parking y Chat sin mostrar tu email.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>Alias público</Text>
            <TextInput
              value={alias}
              onChangeText={handleChangeAlias}
              placeholder="Ej. 4104-BZG"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={40}
              style={styles.input}
            />
            <Text style={styles.help}>
              Es el nombre visible para otros usuarios en Parking y Chat. No
              uses tu nombre real si quieres proteger tu privacidad.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              value={phone}
              onChangeText={handleChangePhone}
              placeholder="Ej. 600 000 000"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              maxLength={30}
              style={styles.input}
            />
            <Text style={styles.help}>
              El teléfono es opcional. Guárdalo solo si quieres usarlo como dato
              de contacto en funciones de Parking.
            </Text>

            <View style={styles.switchRow}>
              <View style={styles.switchTextBox}>
                <Text style={styles.switchTitle}>
                  Mostrar teléfono en Parking
                </Text>
                <Text style={styles.helpNoMargin}>
                  Por defecto queda oculto. Actívalo solo si quieres que otros
                  usuarios puedan verlo.
                </Text>
              </View>

              <Switch
                value={phoneVisible}
                onValueChange={handleChangePhoneVisible}
                disabled={!cleanText(phone)}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextBox}>
                <Text style={styles.switchTitle}>
                  Sincronizar historial de escaneos
                </Text>
                <Text style={styles.helpNoMargin}>
                  Si está activado, los productos escaneados se guardan en
                  Convex para tu cuenta. Si está desactivado, se guardan solo en
                  este navegador o teléfono.
                </Text>
              </View>

              <Switch
                value={scanHistorySyncEnabled}
                onValueChange={handleChangeScanHistorySync}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabledButton]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.86}
          >
            <Ionicons name="checkmark" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>
              {saving ? "Guardando..." : "Guardar perfil"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
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
