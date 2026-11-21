import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { I18nText as Text } from '@/src/i18n';
import { nodeProductReviewsApi } from '@/src/api/providers/node/productReviews';

function formatDate(value) {
  if (!value) return 'Fecha desconocida';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha desconocida' : date.toLocaleString('es-ES');
}

export default function NodeProductReviewsScreen({ accessToken, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await nodeProductReviewsApi.listForAdmin(accessToken, { status: 'pending_review', limit: 300 });
      setSubmissions(Array.isArray(result) ? result : []);
    } catch (cause) {
      setError(cause?.message || 'No se pudieron cargar las propuestas.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);

  const moderate = async (item, action) => {
    setBusyId(item.id);
    setError('');
    try {
      if (action === 'approve') await nodeProductReviewsApi.approveForAdmin(accessToken, item.id);
      else await nodeProductReviewsApi.rejectForAdmin(accessToken, item.id);
      setSubmissions((current) => current.filter((submission) => submission.id !== item.id));
    } catch (cause) {
      setError(cause?.message || 'No se pudo actualizar la propuesta.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmModeration = (item, action) => {
    const approving = action === 'approve';
    Alert.alert(
      approving ? 'Aprobar producto' : 'Rechazar propuesta',
      approving
        ? `La ficha «${item.name}» se publicará en el catálogo compartido.`
        : `La propuesta «${item.name}» se marcará como rechazada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: approving ? 'Aprobar' : 'Rechazar', style: approving ? 'default' : 'destructive', onPress: () => moderate(item, action) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a usuarios" onPress={onBack} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={20} color="#2563eb" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Revisión de productos</Text>
          <Text style={styles.subtitle}>Propuestas pendientes · Node</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualizar" onPress={loadSubmissions} style={styles.iconButton}>
          <Ionicons name="refresh" size={19} color="#2563eb" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.info}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#1d4ed8" />
          <Text style={styles.infoText}>Las propuestas solo se publican en el catálogo después de aprobarlas.</Text>
        </View>
        <Text style={styles.count}>{submissions.length} {submissions.length === 1 ? 'propuesta pendiente' : 'propuestas pendientes'}</Text>
        {error ? <Pressable accessibilityRole="button" onPress={loadSubmissions} style={styles.error}><Text style={styles.errorText}>{error} · Toca para reintentar.</Text></Pressable> : null}
        {loading ? <ActivityIndicator style={styles.spinner} size="large" color="#2563eb" /> : null}
        {!loading && !error && submissions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={42} color="#16a34a" />
            <Text style={styles.emptyTitle}>No hay propuestas pendientes</Text>
            <Text style={styles.emptyText}>Las nuevas propuestas aparecerán aquí para su revisión.</Text>
          </View>
        ) : null}
        {!loading ? submissions.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeading}>
              <View style={styles.productIcon}><Ionicons name="cube-outline" size={21} color="#2563eb" /></View>
              <View style={styles.productHeading}>
                <Text style={styles.productName}>{item.name || 'Producto sin nombre'}</Text>
                <Text style={styles.barcode}>Código {item.barcode}</Text>
              </View>
            </View>
            <View style={styles.fields}>
              {item.brand ? <Text style={styles.field}><Text style={styles.fieldLabel}>Marca: </Text>{item.brand}</Text> : null}
              {item.category ? <Text style={styles.field}><Text style={styles.fieldLabel}>Categoría: </Text>{item.category}</Text> : null}
              {item.notes ? <Text style={styles.field}><Text style={styles.fieldLabel}>Notas: </Text>{item.notes}</Text> : null}
              <Text style={styles.meta}>Enviada por {item.submitterEmail || item.submittedBy || 'usuario'} · {formatDate(item.createdAt)}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={busyId === item.id} onPress={() => confirmModeration(item, 'reject')} style={[styles.action, styles.reject]}>
                <Ionicons name="close" size={17} color="#b91c1c" />
                <Text style={[styles.actionText, styles.rejectText]}>{busyId === item.id ? 'Guardando…' : 'Rechazar'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busyId === item.id} onPress={() => confirmModeration(item, 'approve')} style={[styles.action, styles.approve]}>
                <Ionicons name="checkmark" size={17} color="#15803d" />
                <Text style={[styles.actionText, styles.approveText]}>{busyId === item.id ? 'Guardando…' : 'Aprobar'}</Text>
              </Pressable>
            </View>
          </View>
        )) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#eff6ff' },
  headerCopy: { flex: 1 },
  title: { color: '#0f172a', fontSize: 19, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, paddingBottom: 40 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 13, backgroundColor: '#dbeafe' },
  infoText: { flex: 1, color: '#1e3a8a', fontSize: 13, lineHeight: 18 },
  count: { marginTop: 16, marginBottom: 10, color: '#475569', fontSize: 13, fontWeight: '700' },
  spinner: { marginTop: 28 },
  empty: { alignItems: 'center', padding: 30, borderRadius: 15, backgroundColor: '#fff' },
  emptyTitle: { marginTop: 10, color: '#0f172a', fontWeight: '800', fontSize: 17 },
  emptyText: { marginTop: 5, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  card: { marginBottom: 10, padding: 15, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  productIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#eff6ff' },
  productHeading: { flex: 1, minWidth: 0 },
  productName: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  barcode: { color: '#64748b', fontSize: 12, marginTop: 3 },
  fields: { marginTop: 12, gap: 5 },
  field: { color: '#334155', fontSize: 13, lineHeight: 19 },
  fieldLabel: { color: '#475569', fontWeight: '700' },
  meta: { marginTop: 4, color: '#64748b', fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 14 },
  action: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 13, borderRadius: 10 },
  reject: { backgroundColor: '#fef2f2' },
  approve: { backgroundColor: '#dcfce7' },
  actionText: { fontSize: 13, fontWeight: '700' },
  rejectText: { color: '#b91c1c' },
  approveText: { color: '#15803d' },
  error: { padding: 12, borderRadius: 10, backgroundColor: '#fee2e2' },
  errorText: { color: '#991b1b', fontSize: 13 },
});
