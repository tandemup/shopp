import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import CustomYouTubePlaylistPlayer from '@/src/components/chat/CustomYouTubePlaylistPlayer';
import { parseYouTubeUrl } from '@/src/services/urlSafety';
import { readPlaylistImportAsset } from '@/src/services/playlistArchiveImport';
import { validatePlaylistBackupV2 } from '@/src/services/playlistImportV2';
import { importPlaylistsLocally } from '@/src/services/playlistLocalImport';
import { makePlaylistBackupV2 } from '@/src/services/playlistBackupV2';
import { savePlaylistArchive } from '@/src/services/playlistArchiveZip';
import * as localRepo from '@/src/storage/playlists/playlistRepository';
import { getLocalLyrics, newLyricsStorageKey } from '@/src/storage/lyricsStorage';
import { nodeMusicPlaylistsApi } from '@/src/api/providers/node/musicPlaylists';

const identity = track => `${track?.kind === 'album' ? 'album' : 'single'}:${track?.playlistId || track?.videoId || ''}`;
const urlFor = track => track?.playlistId
  ? `https://www.youtube.com/playlist?list=${track.playlistId}`
  : `https://www.youtube.com/watch?v=${track?.videoId || ''}`;
const explain = error => error?.message || 'No se pudo completar la operación.';

function parseDraft(title, value, existing = []) {
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error('Escribe el título de la playlist.');
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 1 || lines.length > 20) throw new Error('Añade entre 1 y 20 enlaces de YouTube, uno por línea.');
  const oldTracks = new Map(existing.map(track => [identity(track), track]));
  const seen = new Set();
  const tracks = lines.map((line, index) => {
    const separator = line.indexOf('|');
    const label = separator >= 0 ? line.slice(0, separator).trim() : '';
    const url = separator >= 0 ? line.slice(separator + 1).trim() : line;
    const parsed = parseYouTubeUrl(url);
    if (!parsed.isValid || (!parsed.videoId && !parsed.playlistId)) throw new Error(`El enlace de la línea ${index + 1} no es válido.`);
    const kind = parsed.playlistId && !parsed.videoId ? 'album' : 'single';
    const old = oldTracks.get(`${kind}:${parsed.playlistId || parsed.videoId}`);
    const track = { ...old, kind, videoId: parsed.videoId || undefined, playlistId: parsed.playlistId || undefined,
      title: label || old?.title || `Elemento ${index + 1}` };
    const key = identity(track);
    if (seen.has(key)) throw new Error(`El enlace de la línea ${index + 1} está duplicado.`);
    seen.add(key);
    if (!oldTracks.has(key)) track.lyricsDisabled = true;
    return track;
  });
  return { title: cleanTitle, collectionType: 'playlist', tracks };
}

export default function NodeMusicPlaylistsScreen({ accessToken, onBack }) {
  const [local, setLocal] = useState([]);
  const [remoteCount, setRemoteCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [tracksDraft, setTracksDraft] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await localRepo.list('playlist');
      setLocal(items);
      try {
        const remote = await nodeMusicPlaylistsApi.list(accessToken);
        setRemoteCount(remote.length);
      } catch (cause) {
        setRemoteCount(null);
        setError(`Se muestran las playlists locales. No se pudo consultar Node: ${explain(cause)}`);
      }
    } catch (cause) { setError(`No se pudieron leer las playlists locales: ${explain(cause)}`); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { refresh(); }, [refresh]);

  const applyRemote = useCallback(async (remoteItems, conflicts = [], deletedIds = []) => {
    let current = await localRepo.list('playlist');
    const localIds = new Set(current.map(item => String(item.id || item._id)));
    for (const id of deletedIds) {
      if (localIds.has(String(id))) await localRepo.remove(String(id));
    }
    current = await localRepo.list('playlist');
    const byId = new Map(current.map(item => [String(item.id || item._id), item]));
    const protectedIds = new Set(conflicts.map(String));
    for (const remote of remoteItems) {
      const id = String(remote.id || remote._id);
      if (!id || protectedIds.has(id)) continue;
      const previous = byId.get(id);
      if (previous && Number(previous.updatedAt || 0) >= Number(remote.updatedAt || 0)) continue;
      const lyricsChanges = [];
      const tracks = [];
      for (const remoteTrack of remote.tracks || []) {
        const { lyricsText, ...track } = remoteTrack;
        if (typeof lyricsText === 'string') {
          const lyricsKey = track.lyricsKey || newLyricsStorageKey();
          const fileName = String(track.lyricsFileName || 'lyrics.lrc');
          const record = { text: lyricsText, fileName, mimeType: 'text/plain', updatedAt: Date.now(),
            videoId: track.videoId || null, playlistId: track.playlistId || null };
          lyricsChanges.push({ key: lyricsKey, record });
          tracks.push({ ...track, lyricsKey, lyricsDisabled: false, lyricsFileName: fileName,
            lyricsMimeType: 'text/plain', lyricsSize: new TextEncoder().encode(lyricsText).length });
        } else {
          tracks.push({ ...track, lyricsDisabled: track.lyricsDisabled === true });
        }
      }
      await localRepo.saveWithLyrics(previous ? id : undefined, {
        ...remote, id, _id: id, collectionType: 'playlist', tracks,
      }, lyricsChanges);
    }
  }, []);

  const synchronize = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const current = await localRepo.list('playlist');
      const upload = [];
      for (const playlist of current) {
        const tracks = [];
        for (const track of playlist.tracks || []) {
          const record = await getLocalLyrics(track);
          if (record?.text) {
            tracks.push({ ...track, lyricsText: record.text,
              lyricsFileName: record.fileName || track.lyricsFileName || 'lyrics.lrc' });
          } else {
            const claimsLyrics = !track.lyricsDisabled && (track.lyricsKey || track.lyricsFileName || track.lyricsSize || track.lyricsMimeType);
            if (claimsLyrics) throw new Error(`Falta el LRC local de «${playlist.title}», elemento «${track.title}». Exporta y restaura el ZIP v2 antes de sincronizar para no perder la letra.`);
            tracks.push({ ...track, lyricsText: null });
          }
        }
        upload.push({ ...playlist, id: String(playlist.id || playlist._id), collectionType: 'playlist', tracks });
      }
      const result = await nodeMusicPlaylistsApi.sync(accessToken, upload);
      await applyRemote(result.playlists, result.conflicts, result.deletedIds);
      await refresh();
      setMessage(result.conflicts.length
        ? `Sincronización parcial. ${result.conflicts.length} conflicto(s) conservados en ambos lados; exporta una copia ZIP antes de resolverlos.`
        : result.deletedIds.length
          ? `Sincronización completada: ${result.playlists.length} playlist(s) en Node y ${result.deletedIds.length} eliminación(es) aplicadas.`
        : `Sincronización completada: ${result.playlists.length} playlist(s) en Node.`);
    } catch (cause) { setError(explain(cause)); }
    finally { setBusy(false); }
  }, [accessToken, applyRemote, busy, refresh]);

  const openCreate = () => { setEditingId(null); setTitle(''); setTracksDraft(''); setEditorVisible(true); };
  const openEdit = playlist => {
    setEditingId(String(playlist.id || playlist._id));
    setTitle(playlist.title || '');
    setTracksDraft((playlist.tracks || []).map(track => `${track.title || ''} | ${urlFor(track)}`).join('\n'));
    setEditorVisible(true);
  };
  const savePlaylist = async () => {
    setBusy(true); setError('');
    try {
      const existing = local.find(item => String(item.id || item._id) === editingId);
      const playlist = parseDraft(title, tracksDraft, existing?.tracks || []);
      await localRepo.saveWithLyrics(editingId || undefined, playlist, []);
      setEditorVisible(false);
      await refresh();
      await synchronize();
    } catch (cause) { setError(explain(cause)); }
    finally { setBusy(false); }
  };

  const importBackup = async () => {
    setError(''); setMessage('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/json'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      const payload = await readPlaylistImportAsset(picked.assets[0]);
      const type = ['shopp-youtube-playlists', 'shopp-youtube-playlist'].includes(payload?.type) ? payload.type : 'shopp-youtube-playlists';
      const playlists = validatePlaylistBackupV2(payload, type, { minimumTracks: 1, maximumTracks: 20 });
      const result = await importPlaylistsLocally({ playlists, collection: 'playlist', replace: false });
      await refresh();
      setMessage(`Importadas ${result.added} playlists; ${result.skipped} duplicadas omitidas. Ahora sincroniza con Node.`);
    } catch (cause) { setError(explain(cause)); }
  };

  const exportBackup = async () => {
    setError('');
    try {
      const current = await localRepo.list('playlist');
      if (!current.length) throw new Error('No hay playlists locales que exportar.');
      const backup = await makePlaylistBackupV2(current, 'shopp-youtube-playlists', { allowRemoteLyrics: false });
      await savePlaylistArchive(backup, 'Music Playlist');
      setMessage(`Copia ZIP v2 exportada (${current.length} playlists).`);
    } catch (cause) { setError(explain(cause)); }
  };

  const exportPlaylist = async item => {
    try {
      const backup = await makePlaylistBackupV2([item], 'shopp-youtube-playlist', { single: true, allowRemoteLyrics: false });
      await savePlaylistArchive(backup, item.title || 'Music Playlist');
    } catch (cause) { setError(explain(cause)); }
  };

  const deletePlaylist = async item => {
    const id = String(item.id || item._id);
    const remove = async () => {
      setBusy(true); setError('');
      try {
        await nodeMusicPlaylistsApi.remove(accessToken, id);
        await localRepo.remove(id);
        await refresh();
      } catch (cause) { setError(explain(cause)); }
      finally { setBusy(false); }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`¿Borrar «${item.title}» de Node y de este dispositivo?`)) await remove();
    } else Alert.alert('Borrar playlist', `¿Borrar «${item.title}» de Node y de este dispositivo?`, [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: remove },
    ]);
  };

  const renderItem = ({ item }) => <CustomYouTubePlaylistPlayer
    playlist={item}
    userName={item.title}
    dateLabel={new Date(item.updatedAt || Date.now()).toLocaleDateString('es-ES')}
    canEdit
    canDelete
    onEdit={() => openEdit(item)}
    onDelete={() => deletePlaylist(item)}
    onExport={() => exportPlaylist(item)}
  />;

  return <SafeAreaView style={styles.root}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={22} color="#0f172a" /></Pressable><View style={styles.heading}><Text style={styles.title}>Music Playlist · Node</Text><Text style={styles.subtitle}>Sincronización privada y uso local</Text></View></View>
    <View style={styles.summary}><Text style={styles.summaryText}>Este dispositivo: {local.length} · Node: {remoteCount ?? '—'}</Text><Text style={styles.offlineText}>IndexedDB/almacenamiento local sigue disponible sin conexión.</Text></View>
    <View style={styles.actions}>
      <Pressable disabled={busy} onPress={synchronize} style={[styles.primary, busy && styles.disabled]}><Ionicons name="sync-outline" size={18} color="#fff" /><Text style={styles.primaryText}>{busy ? 'Sincronizando…' : 'Sincronizar'}</Text></Pressable>
      <Pressable disabled={busy} onPress={openCreate} style={styles.secondary}><Ionicons name="add" size={19} color="#1d4ed8" /><Text style={styles.secondaryText}>Nueva</Text></Pressable>
      <Pressable disabled={busy} onPress={exportBackup} style={styles.secondary}><Ionicons name="download-outline" size={18} color="#1d4ed8" /><Text style={styles.secondaryText}>Exportar ZIP</Text></Pressable>
      <Pressable disabled={busy} onPress={importBackup} style={styles.secondary}><Ionicons name="archive-outline" size={18} color="#1d4ed8" /><Text style={styles.secondaryText}>Importar ZIP/JSON</Text></Pressable>
    </View>
    {message ? <Text style={styles.notice}>{message}</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#2563eb" /></View> : <FlatList data={local} keyExtractor={item => String(item.id || item._id)} renderItem={renderItem} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No hay playlists musicales locales. Importa un ZIP/JSON v2 o crea una playlist.</Text>} refreshing={loading} onRefresh={refresh} />}
    <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => setEditorVisible(false)}>
      <View style={styles.modalBackdrop}><View style={styles.modal}>
        <Text style={styles.modalTitle}>{editingId ? 'Editar playlist' : 'Nueva playlist'}</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Título" style={styles.input} maxLength={120} />
        <Text style={styles.hint}>Un enlace por línea. Opcionalmente escribe «título | enlace». Se admiten vídeos y playlists de YouTube, hasta 20 elementos.</Text>
        <TextInput value={tracksDraft} onChangeText={setTracksDraft} placeholder={'Canción 1 | https://youtu.be/…\nhttps://www.youtube.com/watch?v=…'} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" autoCapitalize="none" />
        <View style={styles.modalActions}><Pressable onPress={() => setEditorVisible(false)} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable disabled={busy} onPress={savePlaylist} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? 'Guardando…' : 'Guardar y sincronizar'}</Text></Pressable></View>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' }, header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' }, back: { padding: 8 }, heading: { flex: 1 }, title: { color: '#0f172a', fontSize: 20, fontWeight: '800' }, subtitle: { color: '#64748b', marginTop: 3, fontSize: 12 }, summary: { padding: 14, backgroundColor: '#eff6ff', borderBottomWidth: 1, borderBottomColor: '#dbeafe' }, summaryText: { color: '#1e3a8a', fontWeight: '800' }, offlineText: { marginTop: 4, color: '#475569', fontSize: 12 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 }, primary: { minHeight: 42, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 14 }, primaryText: { color: '#fff', fontWeight: '800' }, secondary: { minHeight: 42, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12 }, secondaryText: { color: '#1d4ed8', fontWeight: '700' }, disabled: { opacity: .55 }, notice: { marginHorizontal: 12, marginBottom: 8, color: '#166534', backgroundColor: '#f0fdf4', padding: 10, borderRadius: 8, lineHeight: 19 }, error: { marginHorizontal: 12, marginBottom: 8, color: '#991b1b', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, lineHeight: 19 }, loading: { flex: 1, justifyContent: 'center' }, list: { padding: 12, gap: 8 }, card: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 12, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }, cardText: { flex: 1 }, cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' }, cardMeta: { color: '#64748b', fontSize: 12, marginTop: 4 }, iconButton: { padding: 8 }, empty: { textAlign: 'center', color: '#64748b', lineHeight: 22, padding: 24 }, modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: '#0f172a88', padding: 16 }, modal: { maxHeight: '92%', backgroundColor: '#fff', borderRadius: 18, padding: 18 }, modalTitle: { color: '#0f172a', fontSize: 19, fontWeight: '800', marginBottom: 12 }, input: { minHeight: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', marginBottom: 10 }, hint: { color: '#64748b', fontSize: 12, lineHeight: 18, marginBottom: 8 }, multiline: { minHeight: 150 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
});
