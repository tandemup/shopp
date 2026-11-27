import React, { useEffect, useState } from "react";
import { Platform, SafeAreaView, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import { nodeAuthApi } from "@/src/api/providers/node/auth";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import ProfileLayout, { styles } from "@/src/screens/profile/ProfileLayout";

const ROLE_LABELS = { user: "Usuario", tester: "Tester", admin: "Administrador" };
const JPEG_PREFIX = "data:image/jpeg;base64,";

export default function NodeProfileScreen({
  user, accessToken, onBack, onUpdateProfile, onClearScanHistory, onChangePassword, onChangeEmail,
}) {
  const [name, setName] = useState(user?.name || "");
  const [alias, setAlias] = useState(user?.alias || user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [syncHistory, setSyncHistory] = useState(user?.scanHistorySyncEnabled === true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [avatarAsset, setAvatarAsset] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setAvatarLoading(true);
    nodeAuthApi.getAvatar(accessToken, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setAvatar(result.avatar);
        setAvatarNotice("");
      })
      .catch(err => {
        if (!controller.signal.aborted) setAvatarNotice(err?.message || "No se pudo cargar el avatar.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvatarLoading(false);
      });
    return () => controller.abort();
  }, [accessToken]);

  const pickPhoto = async (camera) => {
    if (avatarLoading || avatarBusy) return;
    setAvatarBusy(true);
    try {
      if (Platform.OS !== "web") {
        const permission = await (camera
          ? ImagePicker.requestCameraPermissionsAsync()
          : ImagePicker.requestMediaLibraryPermissionsAsync());
        if (!permission.granted) throw new Error(camera ? "Autoriza el acceso a la cámara." : "Autoriza el acceso a tus fotos.");
      }
      const options = { mediaTypes: ["images"], allowsEditing: false, quality: 1 };
      const result = await (camera ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options));
      if (!result.canceled && result.assets?.[0]) setAvatarAsset(result.assets[0]);
    } catch (err) {
      safeAlert("No se pudo abrir la imagen", err?.message || "Inténtalo de nuevo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const editAvatar = () => {
    if (!avatar) return pickPhoto(false);
    setAvatarAsset({ uri: JPEG_PREFIX + avatar.base64, width: avatar.size, height: avatar.size });
  };

  const saveAvatar = async (asset) => {
    setAvatarBusy(true);
    try {
      if (!asset.base64) throw new Error("No se pudo leer la imagen editada.");
      const result = await nodeAuthApi.saveAvatar(accessToken, asset.base64);
      setAvatar(result.avatar);
      setAvatarNotice("Avatar guardado.");
      setAvatarAsset(null);
    } catch (err) {
      safeAlert("No se pudo guardar el avatar", err?.message || "Inténtalo de nuevo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = () => safeAlert("Eliminar avatar", "¿Quieres quitar la foto de tu cuenta?", [
    { text: "Cancelar", style: "cancel" },
    { text: "Eliminar", style: "destructive", onPress: async () => {
      setAvatarBusy(true);
      try {
        await nodeAuthApi.removeAvatar(accessToken);
        setAvatar(null);
        setAvatarNotice("Avatar eliminado.");
      } catch (err) {
        setAvatarNotice(err?.message || "No se pudo eliminar el avatar.");
      } finally {
        setAvatarBusy(false);
      }
    } },
  ]);

  const save = async () => {
    const trimmedName = name.trim();
    const trimmedAlias = alias.trim();
    setMessage("");
    if (!trimmedName || trimmedName.length > 120) {
      setError("Escribe un nombre de entre 1 y 120 caracteres.");
      return;
    }
    if (trimmedAlias.length < 2 || trimmedAlias.length > 40) {
      setError("El alias público debe tener entre 2 y 40 caracteres.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const saved = await onUpdateProfile({ name: trimmedName, alias: trimmedAlias, phone: phone.trim(), scanHistorySyncEnabled: syncHistory });
      setName(saved.name || "");
      setAlias(saved.alias || "");
      setPhone(saved.phone || "");
      setSyncHistory(saved.scanHistorySyncEnabled === true);
      setMessage("Perfil guardado.");
    } catch (err) {
      setError(err?.message || "No se pudo actualizar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  const confirmClearHistory = () => safeAlert(
    "Borrar historial de escaneos",
    "¿Quieres borrar los escaneos guardados en el servidor? Los de este dispositivo se conservan.",
    [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar del servidor", style: "destructive", onPress: async () => {
        setClearing(true);
        setError("");
        setMessage("");
        try {
          await onClearScanHistory();
          setMessage("Historial del servidor borrado.");
        } catch (err) {
          setError(err?.message || "No se pudo borrar el historial del servidor.");
        } finally {
          setClearing(false);
        }
      } },
    ],
  );

  const busy = saving || clearing;
  return (
    <SafeAreaView style={styles.screen}>
      <ProfileLayout
        accountLabel={user?.email || "Cuenta de Shopp"}
        onBack={onBack}
        avatar={avatar && { uri: JPEG_PREFIX + avatar.base64 }}
        avatarAsset={avatarAsset}
        avatarBusy={avatarLoading || avatarBusy}
        avatarNotice={avatarLoading ? "Cargando avatar…" : avatarNotice}
        includeAvatarBase64
        onEditAvatar={editAvatar}
        onChooseAvatar={() => pickPhoto(false)}
        onTakeAvatarPhoto={() => pickPhoto(true)}
        onCloseAvatarEditor={() => setAvatarAsset(null)}
        onAvatarEdited={saveAvatar}
        onRemoveAvatar={removeAvatar}
        contentStyle={nodeStyles.content}
      >
        <View style={styles.card}>
          <Text style={styles.label}>Alias público</Text>
          <TextInput value={alias} onChangeText={setAlias} maxLength={40} autoCapitalize="none" autoCorrect={false}
            editable={!saving} style={styles.input} accessibilityLabel="Alias público" />
          <Text style={[styles.label, nodeStyles.nextField]}>Nombre</Text>
          <TextInput value={name} onChangeText={setName} maxLength={120} autoCapitalize="words"
            editable={!saving} style={styles.input} accessibilityLabel="Nombre de perfil" />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Teléfono de contacto</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="Ej. 600 000 000" placeholderTextColor="#64748b"
            maxLength={30} keyboardType="phone-pad" textContentType="telephoneNumber" editable={!saving}
            style={styles.input} accessibilityLabel="Teléfono de contacto privado" />
          <Text style={styles.help}>El teléfono es opcional y solo se muestra en tu cuenta.</Text>
        </View>

        <View style={styles.card}>
          <View style={nodeStyles.historyRow}>
            <View style={styles.switchTextBox}>
              <Text style={styles.switchTitle}>Sincronizar historial de escaneos</Text>
              <Text style={styles.helpNoMargin}>Guarda los próximos escaneos en tu cuenta para consultarlos en otros dispositivos.</Text>
            </View>
            <Switch value={syncHistory} onValueChange={setSyncHistory} disabled={busy}
              accessibilityLabel="Sincronizar historial de escaneos" />
          </View>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={confirmClearHistory} style={nodeStyles.action}>
            <Ionicons name="trash-outline" size={18} color="#b91c1c" />
            <Text style={styles.removeAvatarText}>{clearing ? "Borrando…" : "Borrar historial del servidor"}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text accessibilityRole="alert" style={nodeStyles.error}>{error}</Text> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={nodeStyles.status}>{message}</Text> : null}

        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={save}
          style={[styles.primaryButton, busy && styles.disabledButton]}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>{saving ? "Guardando…" : "Guardar perfil"}</Text>
        </TouchableOpacity>

        <View style={[styles.card, nodeStyles.account]}>
          <Text style={styles.label}>Cuenta</Text>
          <Text style={styles.helpNoMargin}>{ROLE_LABELS[user?.role] || "Usuario"} · {user?.emailVerified ? "Correo verificado" : "Correo pendiente de verificación"}</Text>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onChangeEmail} style={nodeStyles.action}>
            <Ionicons name="mail-outline" size={18} color="#15803d" />
            <Text style={styles.avatarActionText}>Cambiar correo</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onChangePassword} style={nodeStyles.action}>
            <Ionicons name="key-outline" size={18} color="#15803d" />
            <Text style={styles.avatarActionText}>Cambiar contraseña</Text>
          </TouchableOpacity>
        </View>
      </ProfileLayout>
    </SafeAreaView>
  );
}

const nodeStyles = StyleSheet.create({
  content: { width: "100%", maxWidth: 720, alignSelf: "center" },
  nextField: { marginTop: 14 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  action: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, marginTop: 6 },
  account: { marginTop: 18 },
  error: { color: "#b91c1c", marginBottom: 8 },
  status: { color: "#15803d", marginBottom: 8 },
});
