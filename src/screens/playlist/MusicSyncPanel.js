import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { I18nText as Text } from '@/src/i18n';
import { safeAlert, safeConfirm } from '@/src/components/ui/alert/safeAlert';
import { previewManualSync } from '@/src/services/musicSync/manualSync';
import { uploadCompleteManual, previewRemoteComplete, importNewRemoteManual } from '@/src/services/musicSync/completeTransfer';

// No automatic writes. Preview only, then explicit per-playlist consent.
export default function MusicSyncPanel({ visible, onClose, collection, onImported }) {
  const client = useConvex();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    setBusy(true); setMessage('');
    try { setPreview(await previewManualSync(client, api)); }
    catch (error) { setMessage(error?.message || 'No se pudo consultar Convex'); }
    finally { setBusy(false); }
  }, [client]);
  const execute = useCallback((title, description, operation) => {
    safeConfirm(title, description, async () => {
      setBusy(true); setMessage('');
      try { await operation(); await refresh(); }
      catch (error) { setMessage(error?.message || 'La operación no pudo completarse'); safeAlert('Sincronización', error?.message || 'Error'); }
      finally { setBusy(false); }
    });
  }, [refresh]);
  const upload = useCallback(row => execute('Subir playlist',
    `¿Subir «${row.title || row.id}» a tu cuenta? Antes debes exportar una copia de seguridad. No reemplazará ninguna playlist remota existente.`,
    async () => { const result = await uploadCompleteManual(client, api, row.id); if (result?.status !== 'uploaded') throw new Error('La playlist ya existe en Convex. No se ha sobrescrito.'); }), [client, execute]);
  const download = useCallback(row => execute('Importar playlist',
    `¿Importar «${row.localId}» a este dispositivo? Haz antes una copia de seguridad. Solo se importará si ese ID no existe localmente.`,
    async () => {
      const check = await previewRemoteComplete(client, api, row.localId);
      if (!check?.canImport) throw new Error('La playlist ya existe localmente: requiere revisión manual.');
      await importNewRemoteManual(client, api, row.localId);
      await onImported?.();
    }), [client, execute, onImported]);
  const localOnly = (preview?.localOnly || []).filter(x => x.collectionType === collection);
  const remoteOnly = (preview?.remoteOnly || []).filter(x => x.collectionType === collection);
  const conflicts = (preview?.requiresReview || []).filter(x => x.collectionType === collection || !x.collectionType);
  return <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
    <View style={styles.overlay}><View style={styles.sheet}>
      <View style={styles.top}><Text style={styles.title}>Sincronización manual · {collection === 'classical' ? 'Classical' : 'Music'}</Text><Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.action}>Cerrar</Text></Pressable></View>
      <Text style={styles.note}>Modo seguro: no se sincroniza automáticamente. Exporta antes un respaldo JSON/ZIP. Las coincidencias de ID se dejan sin modificar.</Text>
      {Platform.OS !== 'web' ? <Text style={styles.warning}>Esta versión solo permite importar playlists completas en la PWA web. La importación nativa está bloqueada para proteger los LRC.</Text> : null}
      <Pressable style={[styles.button,busy && styles.disabled]} disabled={busy} accessibilityRole="button" onPress={refresh}><Text style={styles.buttonText}>{busy ? 'Consultando…' : 'Comparar con Convex'}</Text></Pressable>
      {busy ? <ActivityIndicator /> : null}
      {message ? <Text style={styles.warning}>{message}</Text> : null}
      <ScrollView style={styles.scroll}>
        {preview ? <>
          <Text style={styles.section}>Solo en este dispositivo ({localOnly.length})</Text>
          {localOnly.map(row => <View style={styles.item} key={`local-${row.id}`}><Text style={styles.itemText}>{row.title || row.id}</Text><Pressable disabled={busy} accessibilityRole="button" onPress={() => upload(row)}><Text style={styles.action}>Subir</Text></Pressable></View>)}
          <Text style={styles.section}>Solo en Convex ({remoteOnly.length})</Text>
          {remoteOnly.map(row => <View style={styles.item} key={`remote-${row.localId}`}><Text style={styles.itemText}>{row.localId}</Text><Pressable disabled={busy || Platform.OS !== 'web'} accessibilityRole="button" onPress={() => download(row)}><Text style={styles.action}>{Platform.OS === 'web' ? 'Importar' : 'Solo PWA'}</Text></Pressable></View>)}
          <Text style={styles.section}>Requieren revisión ({conflicts.length})</Text>
          {conflicts.map(row => <View style={styles.item} key={`review-${row.id}`}><Text style={styles.itemText}>{row.title || row.id} · revisión remota {row.serverRevision}</Text><Text style={styles.warning}>Sin cambios</Text></View>)}
        </> : null}
      </ScrollView>
    </View></View>
  </Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'rgba(0,0,0,.45)',justifyContent:'center',padding:12},sheet:{backgroundColor:'#fff',borderRadius:14,padding:16,maxHeight:'90%'},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},title:{fontSize:18,fontWeight:'700',color:'#10253d',flex:1},note:{fontSize:13,color:'#475569',marginVertical:10},warning:{fontSize:12,color:'#a3420c',marginVertical:6},button:{backgroundColor:'#2563eb',padding:11,borderRadius:8,alignItems:'center'},disabled:{opacity:.5},buttonText:{color:'#fff',fontWeight:'700'},scroll:{marginTop:12},section:{fontWeight:'700',fontSize:15,color:'#1e293b',marginTop:15,marginBottom:5},item:{borderBottomWidth:1,borderBottomColor:'#e2e8f0',paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10,justifyContent:'space-between'},itemText:{flex:1,color:'#334155'},action:{color:'#2563eb',fontWeight:'700'}});
