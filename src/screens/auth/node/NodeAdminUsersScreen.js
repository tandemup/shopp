import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { I18nText as Text } from '@/src/i18n';
import { nodeAdminUsersApi } from '@/src/api/providers/node/adminUsers';

const FEATURES = [
  ['scanner', 'Escáner'], ['stores', 'Tiendas'], ['chat', 'Chat'], ['parking', 'Aparcamiento'],
  ['englishTutor', 'Tutor de inglés'], ['library', 'Biblioteca'], ['musicPlaylist', 'Lista de música'],
  ['classicalMusic', 'Música clásica'], ['tutorials', 'Tutoriales'], ['news', 'Noticias'],
  ['shoppLive', 'Shopp en directo'], ['p2pPlaylistExchange', 'Intercambio P2P'],
  ['fireAlarm', 'Alarma de incendios'], ['investments', 'Inversiones'],
];
const TESTER_DEFAULTS = { scanner: true, stores: true, musicPlaylist: true, classicalMusic: true, tutorials: true, p2pPlaylistExchange: true };
const blankPermissions = () => Object.fromEntries(FEATURES.map(([key]) => [key, false]));

function confirmAction(title, message, action) {
  Alert.alert(title, message, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: action }]);
}

export default function NodeAdminUsersScreen({ user, accessToken, onBack, onOpenProductReviews }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [permissions, setPermissions] = useState(blankPermissions());

  const loadUsers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await nodeAdminUsersApi.list(accessToken);
      setUsers(Array.isArray(result?.users) ? result.users : []);
    } catch (cause) { setError(cause?.message || 'No se pudieron cargar los usuarios.'); }
    finally { setLoading(false); }
  }, [accessToken]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const run = async (target, request) => {
    setBusyId(target.id); setError('');
    try { await request(); await loadUsers(); }
    catch (cause) { setError(cause?.message || 'No se pudo guardar el cambio.'); }
    finally { setBusyId(null); }
  };

  const cycleRole = (target) => {
    const role = target.role === 'user' ? 'tester' : target.role === 'tester' ? 'admin' : 'user';
    if (target.id === user?.id && role !== 'admin') return setError('No puedes retirar tu propio rol de administrador.');
    confirmAction('Cambiar rol', `¿Asignar el rol ${role} a ${target.email || target.name}?`, () => run(target, () => nodeAdminUsersApi.setRole(accessToken, target.id, role)));
  };
  const changeStatus = (target) => {
    const status = target.status === 'blocked' ? 'active' : 'blocked';
    if (target.id === user?.id && status === 'blocked') return setError('No puedes bloquear tu propia cuenta.');
    confirmAction(status === 'blocked' ? 'Bloquear usuario' : 'Desbloquear usuario', `${status === 'blocked' ? 'Bloquear' : 'Desbloquear'} ${target.email || target.name}?`, () => run(target, () => nodeAdminUsersApi.setStatus(accessToken, target.id, status)));
  };
  const openPermissions = (target) => {
    setEditing(target);
    setPermissions({ ...blankPermissions(), ...(target.permissions || {}) });
  };
  const applyTesterDefaults = () => setPermissions({ ...blankPermissions(), ...TESTER_DEFAULTS });
  const savePermissions = async () => {
    if (!editing) return;
    await run(editing, async () => {
      await nodeAdminUsersApi.setPermissions(accessToken, editing.id, permissions);
      setEditing(null);
    });
  };

  const sortedUsers = useMemo(() => [...users].sort((a, b) => String(a.email || a.name).localeCompare(String(b.email || b.name))), [users]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a compras" onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={20} color="#2563eb" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title}>Usuarios</Text><Text style={styles.subtitle}>Roles y permisos · Node</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualizar" onPress={loadUsers} style={styles.back}><Ionicons name="refresh" size={19} color="#2563eb" /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.info}><Ionicons name="shield-checkmark-outline" size={20} color="#1d4ed8" /><Text style={styles.infoText}>Acceso protegido: solo el servidor autoriza operaciones administrativas.</Text></View>
        {onOpenProductReviews ? <Pressable accessibilityRole="button" onPress={onOpenProductReviews} style={styles.reviewButton}><Ionicons name="cube-outline" size={19} color="#1d4ed8" /><Text style={styles.reviewButtonText}>Revisar propuestas de productos</Text><Ionicons name="chevron-forward" size={18} color="#1d4ed8" /></Pressable> : null}
        <Text style={styles.count}>{users.length} {users.length === 1 ? 'usuario' : 'usuarios'}</Text>
        {error ? <Pressable onPress={() => setError('')} style={styles.error}><Text style={styles.errorText}>{error}</Text></Pressable> : null}
        {loading ? <ActivityIndicator style={{ marginTop: 26 }} size="large" color="#2563eb" /> : sortedUsers.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.personIcon}><Ionicons name={item.role === 'admin' ? 'shield-checkmark' : 'person-outline'} size={21} color={item.role === 'admin' ? '#15803d' : '#475569'} /></View>
            <View style={styles.details}>
              <Text style={styles.email} numberOfLines={1}>{item.email || item.name || item.id}</Text>
              {item.name && item.email ? <Text style={styles.name} numberOfLines={1}>{item.name}</Text> : null}
              <Text style={styles.meta}>{item.role === 'admin' ? 'Administrador' : item.role === 'tester' ? 'Tester' : 'Usuario'} · {item.status === 'blocked' ? 'Bloqueado' : 'Activo'} · {item.emailVerified ? 'Correo verificado' : 'Sin verificar'}</Text>
              <View style={styles.actions}>
                <Pressable disabled={busyId === item.id} onPress={() => cycleRole(item)} style={[styles.action, item.role === 'admin' && styles.adminAction]}><Text style={styles.actionText}>{busyId === item.id ? 'Guardando…' : 'Cambiar rol'}</Text></Pressable>
                <Pressable disabled={busyId === item.id} onPress={() => changeStatus(item)} style={[styles.action, item.status === 'blocked' && styles.adminAction]}><Text style={styles.actionText}>{item.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}</Text></Pressable>
                {item.role !== 'admin' ? <Pressable disabled={busyId === item.id} onPress={() => openPermissions(item)} style={styles.action}><Text style={styles.actionText}>Permisos</Text></Pressable> : null}
              </View>
            </View>
          </View>
        ))}
        <View style={styles.note}><Text style={styles.noteTitle}>Pendiente de otra fase</Text><Text style={styles.noteText}>Las invitaciones de testers y la migración de cuentas/roles ya existentes desde Convex aún no están incluidas.</Text></View>
      </ScrollView>
      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.backdrop}><View style={styles.modal}>
          <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>Permisos</Text><Text style={styles.subtitle} numberOfLines={1}>{editing?.email}</Text></View><Pressable accessibilityLabel="Cerrar" onPress={() => setEditing(null)}><Ionicons name="close" size={24} color="#475569" /></Pressable></View>
          <Pressable style={styles.defaults} onPress={applyTesterDefaults}><Text style={styles.defaultsText}>Aplicar acceso inicial de tester</Text></Pressable>
          <ScrollView style={styles.permissionList}>{FEATURES.map(([key, label]) => <View key={key} style={styles.permissionRow}><Text style={styles.permissionLabel}>{label}</Text><Switch value={permissions[key] === true} onValueChange={(value) => setPermissions((current) => ({ ...current, [key]: value }))} /></View>)}</ScrollView>
          <View style={styles.modalActions}><Pressable onPress={() => setEditing(null)} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable disabled={busyId === editing?.id} onPress={savePermissions} style={styles.save}><Text style={styles.saveText}>{busyId === editing?.id ? 'Guardando…' : 'Guardar'}</Text></Pressable></View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' }, header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#eff6ff' }, headerCopy: { flex: 1 }, title: { color: '#0f172a', fontSize: 20, fontWeight: '800' }, subtitle: { color: '#64748b', fontSize: 12, marginTop: 2 }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, paddingBottom: 40 }, info: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 13, backgroundColor: '#dbeafe' }, infoText: { flex: 1, color: '#1e3a8a', fontSize: 13, lineHeight: 18 }, reviewButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#bfdbfe' }, reviewButtonText: { flex: 1, color: '#1d4ed8', fontSize: 14, fontWeight: '700' }, count: { marginTop: 16, marginBottom: 10, color: '#475569', fontSize: 13, fontWeight: '700' }, card: { flexDirection: 'row', gap: 12, marginBottom: 9, padding: 14, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }, personIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#f1f5f9' }, details: { flex: 1, minWidth: 0 }, email: { color: '#0f172a', fontSize: 15, fontWeight: '800' }, name: { color: '#64748b', fontSize: 13, marginTop: 2 }, meta: { color: '#64748b', fontSize: 12, marginTop: 5 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, action: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, backgroundColor: '#eff6ff' }, adminAction: { backgroundColor: '#dcfce7' }, actionText: { color: '#1d4ed8', fontSize: 12, fontWeight: '700' }, error: { padding: 12, borderRadius: 10, backgroundColor: '#fee2e2' }, errorText: { color: '#991b1b', fontSize: 13 }, note: { marginTop: 16, padding: 14, borderRadius: 13, backgroundColor: '#fff7ed' }, noteTitle: { color: '#9a3412', fontWeight: '800' }, noteText: { marginTop: 4, color: '#9a3412', fontSize: 13, lineHeight: 18 }, backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#0f172a88' }, modal: { width: '100%', maxWidth: 500, maxHeight: '92%', padding: 18, borderRadius: 18, backgroundColor: '#fff' }, modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, modalTitle: { color: '#0f172a', fontSize: 20, fontWeight: '800' }, defaults: { marginTop: 14, padding: 11, alignItems: 'center', borderRadius: 10, backgroundColor: '#eff6ff' }, defaultsText: { color: '#1d4ed8', fontWeight: '700' }, permissionList: { marginTop: 8 }, permissionRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, permissionLabel: { color: '#334155', fontSize: 14 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }, cancel: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14 }, cancelText: { color: '#475569', fontWeight: '700' }, save: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#2563eb' }, saveText: { color: '#fff', fontWeight: '800' },
});
