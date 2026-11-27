import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import CustomYouTubePlaylistPlayer from '@/src/components/chat/CustomYouTubePlaylistPlayer';
import { MusicCardPrintEditor } from '@/src/screens/playlist/PrintMusicCardScreen';
import { parseYouTubeUrl } from '@/src/services/urlSafety';
import { isPlaylistArtwork } from '@/src/services/playlistArtwork';
import { getPlaylistArtworkSize, preparePickedPlaylistArtwork, preparePlaylistArtwork } from '@/src/services/preparePlaylistArtwork';
import { readPlaylistImportAsset } from '@/src/services/playlistArchiveImport';
import { validatePlaylistImport } from '@/src/services/playlistImportV2';
import { importPlaylistsLocally } from '@/src/services/playlistLocalImport';
import { makePlaylistBackupV2 } from '@/src/services/playlistBackupV2';
import { savePlaylistArchive } from '@/src/services/playlistArchiveZip';
import * as localRepo from '@/src/storage/playlists/playlistRepository';
import { getLocalLyrics, newLyricsStorageKey } from '@/src/storage/lyricsStorage';

const MAX_LRC_BYTES = 512 * 1024;
const CLASSICAL_FIELDS = [
  ['composer', 'Compositor'],
  ['performer', 'Intérprete'],
  ['conductor', 'Director'],
  ['orchestra', 'Orquesta'],
  ['period', 'Periodo'],
  ['year', 'Año'],
];
const identity = track => track?.kind === 'album' ? `album:${track.playlistId}` : `single:${track?.videoId}`;
const urlFor = track => track?.kind === 'album'
  ? `https://www.youtube.com/playlist?list=${track.playlistId}`
  : `https://www.youtube.com/watch?v=${track?.videoId || ''}${track?.playlistId ? `&list=${track.playlistId}` : ''}`;
const explain = error => error?.message || 'No se pudo completar la operación.';

const normalizeSearch = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function playlistSearchText(playlist) {
  const fields = [playlist.title, playlist.author, playlist.artist];
  if (playlist.collectionType === 'classical') {
    fields.push(...CLASSICAL_FIELDS.map(([key]) => playlist[key]));
    for (const work of playlist.works || []) {
      fields.push(work.title, work.subtitle, work.composer, work.conductor, work.orchestra, work.soloist);
    }
  }
  for (const track of playlist.tracks || []) {
    fields.push(track.title, track.author, track.artist);
  }
  return normalizeSearch(fields.join(' '));
}

function CoverPreview({ uri }) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    let current = true;
    getPlaylistArtworkSize(uri).then(
      dimensions => {
        if (current) setSize({ uri, ...dimensions });
      },
      () => {
        if (current) setSize(null);
      },
    );
    return () => { current = false; };
  }, [uri]);

  return (
    <View style={styles.coverPreviewRow}>
      <Image source={{ uri }} style={styles.coverPreview} resizeMode="contain" />
      {size?.uri === uri && size.width > 0 && size.height > 0 ? (
        <Text style={styles.coverDimensions}>{size.width} × {size.height} px</Text>
      ) : null}
    </View>
  );
}

function lyricsFileSize(fileName, text) {
  if (!/\.lrc$/i.test(fileName)) throw new Error('Selecciona un archivo con extensión .lrc.');
  if (!text.trim()) throw new Error('Escribe la letra o pulsa «Quitar letra» si quieres dejarla vacía.');
  const size = new TextEncoder().encode(text).length;
  if (size > MAX_LRC_BYTES) throw new Error('El archivo LRC no puede superar 512 KB.');
  return size;
}

let draftSequence = 0;
function makeDraft(track = null) {
  return {
    key: ++draftSequence,
    title: track?.title || '',
    url: track ? urlFor(track) : '',
    artworkUrl: track?.artworkUrl || '',
    original: track,
    lyrics: undefined,
  };
}

function draftMedia(url) {
  const parsed = parseYouTubeUrl(url.trim());
  if (!parsed.isValid) return null;
  return {
    kind: parsed.videoId ? 'single' : 'album',
    videoId: parsed.videoId || undefined,
    playlistId: parsed.playlistId || undefined,
  };
}

function originalTrackFor(draft, media = draftMedia(draft.url)) {
  return media && draft.original && identity(draft.original) === identity(media)
    ? draft.original : null;
}

function parseDraft(title, drafts, collection, classicalDetails) {
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error('Escribe el título de la playlist.');
  const elements = drafts.filter(draft => draft.url.trim() || draft.title.trim() || draft.artworkUrl.trim() || draft.lyrics);
  if (elements.length < 1 || elements.length > 20) throw new Error('Añade entre 1 y 20 elementos de YouTube.');
  const lyricsChanges = [];
  const tracks = elements.map((draft, index) => {
    const media = draftMedia(draft.url);
    if (!media) throw new Error(`Introduce un enlace válido para el elemento ${index + 1}.`);
    const originalTrack = originalTrackFor(draft, media);
    const artworkUrl = draft.artworkUrl.trim();
    if (artworkUrl && !isPlaylistArtwork(artworkUrl)) {
      throw new Error(`Sustituye o quita la carátula no válida del elemento ${index + 1}.`);
    }
    const track = {
      ...(originalTrack || { lyricsDisabled: true }),
      ...media,
      title: draft.title.trim() || `Elemento ${index + 1}`,
      artworkUrl,
    };
    if (draft.lyrics !== undefined) {
      for (const field of ['lyricsKey', 'lyricsFileName', 'lyricsMimeType', 'lyricsSize', 'lyricsStorageId', 'lyricsUri', 'lyricsUrl']) {
        delete track[field];
      }
      track.lyricsDisabled = !draft.lyrics;
      if (draft.lyrics) {
        // Replacing a letter creates a private key for this occurrence.
        const key = newLyricsStorageKey();
        const { fileName, text } = draft.lyrics;
        const lyricsSize = lyricsFileSize(fileName, text);
        lyricsChanges.push({
          key,
          record: { fileName, text, mimeType: 'text/plain', updatedAt: Date.now(),
            videoId: track.videoId || null, playlistId: track.playlistId || null },
        });
        Object.assign(track, {
          lyricsKey: key, lyricsFileName: fileName, lyricsMimeType: 'text/plain',
          lyricsSize,
        });
      }
    }
    return track;
  });
  const playlist = { title: cleanTitle, collectionType: collection, tracks };
  if (collection === 'classical') {
    for (const [key] of CLASSICAL_FIELDS) playlist[key] = classicalDetails[key]?.trim() || '';
  }
  return { playlist, lyricsChanges };
}

export default function NodePlaylistCollectionScreen({ accessToken, onBack, collection, playlistsApi }) {
  const isClassical = collection === 'classical';
  const screenTitle = isClassical ? 'Música clásica · Node' : 'Music Playlist · Node';
  const backupType = isClassical ? 'shopp-youtube-classical-playlist' : 'shopp-youtube-playlist';
  const searchLabel = isClassical ? 'Buscar colecciones u obras' : 'Buscar playlists o canciones';
  const [local, setLocal] = useState([]);
  const [remoteCount, setRemoteCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [tracksDraft, setTracksDraft] = useState(() => [makeDraft()]);
  const [editorError, setEditorError] = useState('');
  const [picking, setPicking] = useState(false);
  const [lyricsEditor, setLyricsEditor] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [printPlaylist, setPrintPlaylist] = useState(null);
  const [classicalDetails, setClassicalDetails] = useState({});
  const [worksCount, setWorksCount] = useState(0);
  const editorBusy = busy || picking;

  const searchIndex = useMemo(() => local.map(item => ({ item, text: playlistSearchText(item) })), [local]);
  const searchTerms = useMemo(() => normalizeSearch(searchText).split(/\s+/).filter(Boolean), [searchText]);
  const visiblePlaylists = useMemo(() => searchTerms.length
    ? searchIndex.filter(({ text }) => searchTerms.every(term => text.includes(term))).map(({ item }) => item)
    : local, [local, searchIndex, searchTerms]);

  // A cover truncated by an older server should use the regular video thumbnail.
  const playablePlaylists = useMemo(() => new Map(local.map(item => [item, {
    ...item,
    ...(isClassical ? { artworkUrl: [item.artworkUrl, item.coverImage, item.imageUrl].find(isPlaylistArtwork) || '', coverImage: '', imageUrl: '' } : {}),
    tracks: (item.tracks || []).map(track => track.artworkUrl && !isPlaylistArtwork(track.artworkUrl)
      ? { ...track, artworkUrl: '' } : track),
  }])), [local, isClassical]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await localRepo.list(collection);
      setLocal(items);
      try {
        const remote = await playlistsApi.list(accessToken);
        setRemoteCount(remote.length);
      } catch (cause) {
        setRemoteCount(null);
        setError(`Se muestran las playlists locales. No se pudo consultar Node: ${explain(cause)}`);
      }
    } catch (cause) { setError(`No se pudieron leer las playlists locales: ${explain(cause)}`); }
    finally { setLoading(false); }
  }, [accessToken, collection, playlistsApi]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!printPlaylist || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setPrintPlaylist(null);
      return true;
    });
    return () => subscription.remove();
  }, [printPlaylist]);

  const applyRemote = useCallback(async (remoteItems, conflicts = [], deletedIds = []) => {
    let current = await localRepo.list(collection);
    const localIds = new Set(current.map(item => String(item.id || item._id)));
    for (const id of deletedIds) {
      if (localIds.has(String(id))) await localRepo.remove(String(id));
    }
    current = await localRepo.list(collection);
    const byId = new Map(current.map(item => [String(item.id || item._id), item]));
    const protectedIds = new Set(conflicts.map(String));
    for (const remote of remoteItems) {
      const id = String(remote.id || remote._id || '');
      if (remote.collectionType !== collection) continue;
      if (!id || protectedIds.has(id)) continue;
      const previous = byId.get(id);
      if (previous && Number(previous.updatedAt || 0) >= Number(remote.updatedAt || 0)) continue;
      const lyricsChanges = [];
      const tracks = [];
      for (const remoteTrack of remote.tracks || []) {
        const { lyricsText, ...track } = remoteTrack;
        if (typeof lyricsText === 'string') {
          const lyricsKey = /^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/.test(track.lyricsKey)
            ? track.lyricsKey : newLyricsStorageKey();
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
        ...remote, id, _id: id, collectionType: collection, tracks,
      }, lyricsChanges, { preserveTimestamps: true });
    }
  }, [collection]);

  const synchronize = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const current = await localRepo.list(collection);
      const upload = [];
      for (const playlist of current) {
        const tracks = [];
        for (const track of playlist.tracks || []) {
          const record = await getLocalLyrics(track);
          const artworkUrl = isPlaylistArtwork(track.artworkUrl) ? track.artworkUrl : '';
          if (typeof record?.text === 'string') {
            tracks.push({ ...track, artworkUrl, lyricsText: record.text,
              lyricsFileName: record.fileName || track.lyricsFileName || 'lyrics.lrc' });
          } else {
            const claimsLyrics = !track.lyricsDisabled && (track.lyricsKey || track.lyricsFileName || track.lyricsSize || track.lyricsMimeType);
            if (claimsLyrics) throw new Error(`Falta el LRC local de «${playlist.title}», elemento «${track.title}». Exporta y restaura el ZIP v2 antes de sincronizar para no perder la letra.`);
            tracks.push({ ...track, artworkUrl, lyricsText: null });
          }
        }
        const item = { ...playlist, id: String(playlist.id || playlist._id), collectionType: collection, tracks };
        if (isClassical) item.artworkUrl = [playlist.artworkUrl, playlist.coverImage, playlist.imageUrl].find(isPlaylistArtwork) || '';
        upload.push(item);
      }
      const result = await playlistsApi.sync(accessToken, upload);
      await applyRemote(result.playlists, result.conflicts, result.deletedIds);
      await refresh();
      setMessage(result.conflicts.length
        ? `Sincronización parcial. ${result.conflicts.length} conflicto(s) conservados en ambos lados; exporta una copia ZIP antes de resolverlos.`
        : result.deletedIds.length
          ? `Sincronización completada: ${result.playlists.length} playlist(s) en Node y ${result.deletedIds.length} eliminación(es) aplicadas.`
        : `Sincronización completada: ${result.playlists.length} playlist(s) en Node.`);
    } catch (cause) { setError(explain(cause)); }
    finally { setBusy(false); }
  }, [accessToken, applyRemote, busy, collection, isClassical, playlistsApi, refresh]);

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setTracksDraft([makeDraft()]);
    setClassicalDetails({});
    setWorksCount(0);
    setEditorError('');
    setLyricsEditor(null);
    setEditorVisible(true);
  };
  const openEdit = playlist => {
    setEditingId(String(playlist.id || playlist._id));
    setTitle(playlist.title || '');
    setTracksDraft(playlist.tracks?.length ? playlist.tracks.map(makeDraft) : [makeDraft()]);
    setClassicalDetails(isClassical
      ? Object.fromEntries(CLASSICAL_FIELDS.map(([key]) => [key, String(playlist[key] || '')]))
      : {});
    setWorksCount(playlist.works?.length || 0);
    setEditorError('');
    setLyricsEditor(null);
    setEditorVisible(true);
  };
  const updateDraftTrack = (key, field, value) => setTracksDraft(current =>
    current.map(track => track.key === key ? { ...track, [field]: value } : track));

  const pickTrackLyrics = async key => {
    if (editorBusy) return;
    setPicking(true);
    setEditorError('');
    try {
      // iOS does not consistently assign a MIME type to .lrc files.
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      const fileName = asset.name || 'lyrics.lrc';
      if (!/\.lrc$/i.test(fileName)) throw new Error('Selecciona un archivo con extensión .lrc.');
      if (asset.size > MAX_LRC_BYTES) throw new Error('El archivo LRC no puede superar 512 KB.');
      const response = asset.file ? null : await fetch(asset.uri);
      if (response && !response.ok) throw new Error('No se pudo leer el archivo LRC.');
      const text = asset.file ? await asset.file.text() : await response.text();
      lyricsFileSize(fileName, text);
      updateDraftTrack(key, 'lyrics', { fileName, text });
      setLyricsEditor({ key, fileName, text });
    } catch (cause) { setEditorError(explain(cause)); }
    finally { setPicking(false); }
  };

  const openTrackLyrics = async track => {
    if (editorBusy) return;
    setPicking(true);
    setEditorError('');
    try {
      const originalTrack = originalTrackFor(track);
      const original = track.lyrics === undefined && originalTrack
        ? await getLocalLyrics(originalTrack) : null;
      const lyrics = track.lyrics || original;
      setLyricsEditor({
        key: track.key,
        fileName: lyrics?.fileName || originalTrack?.lyricsFileName || 'lyrics.lrc',
        text: lyrics?.text ?? '',
      });
    } catch (cause) { setEditorError(explain(cause)); }
    finally { setPicking(false); }
  };

  const changeLyricsText = (editor, text) => {
    setLyricsEditor({ ...editor, text });
    updateDraftTrack(editor.key, 'lyrics', { fileName: editor.fileName, text });
  };

  const clearTrackLyrics = key => {
    if (lyricsEditor?.key === key) setLyricsEditor(null);
    updateDraftTrack(key, 'lyrics', null);
  };

  const pickTrackArtwork = async key => {
    if (editorBusy) return;
    setPicking(true);
    setEditorError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], exif: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const artworkUrl = await preparePickedPlaylistArtwork(result.assets[0]);
      updateDraftTrack(key, 'artworkUrl', artworkUrl);
    } catch (cause) { setEditorError(explain(cause)); }
    finally { setPicking(false); }
  };
  const moveDraftTrack = (index, direction) => setTracksDraft(current => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const removeDraftTrack = index => setTracksDraft(current => current.length <= 1 ? current : current.filter((_, i) => i !== index));
  const savePlaylist = async () => {
    if (editorBusy) return;
    setBusy(true); setError(''); setEditorError('');
    try {
      const { playlist, lyricsChanges } = parseDraft(title, tracksDraft, collection, classicalDetails);
      const originalCovers = new Set(tracksDraft.map(track => track.original?.artworkUrl));
      for (const [index, track] of playlist.tracks.entries()) {
        // Keep saved links editable while offline. New links and embedded
        // covers are checked before they enter local storage.
        if (track.artworkUrl.startsWith('https://') && originalCovers.has(track.artworkUrl)) continue;
        try {
          track.artworkUrl = await preparePlaylistArtwork(track.artworkUrl);
        } catch (cause) {
          throw new Error(`Carátula del elemento ${index + 1}. ${explain(cause)}`);
        }
      }
      await localRepo.saveWithLyrics(editingId || undefined, playlist, lyricsChanges);
      setEditorVisible(false);
      await refresh();
      await synchronize();
    } catch (cause) { setEditorError(explain(cause)); }
    finally { setBusy(false); }
  };

  const pickBackup = async () => {
    if (busy) return;
    setBusy(true);
    setError(''); setMessage('');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', 'application/json'],
        copyToCacheDirectory: true,
      });
      const asset = picked.assets?.[0];
      if (picked.canceled || !asset) return;
      const payload = await readPlaylistImportAsset(asset);
      const playlists = validatePlaylistImport(payload, backupType, { maximumTracks: 20, preserveArtwork: true });
      setPendingImport({ name: asset.name, version: payload.version, playlists });
    } catch (cause) { setError(`No se pudo leer el respaldo: ${explain(cause)}`); }
    finally { setBusy(false); }
  };

  const importBackup = async replace => {
    if (busy || !pendingImport) return;
    setBusy(true);
    setPendingImport(null);
    try {
      const result = await importPlaylistsLocally({ playlists: pendingImport.playlists, collection, replace });
      await refresh();
      const counts = `Añadidas: ${result.added} · Duplicadas omitidas: ${result.skipped} · Letras LRC restauradas: ${result.lyricsRestored}`;
      setMessage(replace ? `Reemplazo local completado. Listas anteriores retiradas: ${result.replaced}. ${counts}.` : `Importación combinada. ${counts}.`);
    } catch (cause) { setError(`No se pudo importar el respaldo: ${explain(cause)}`); }
    finally { setBusy(false); }
  };

  const exportBackup = async () => {
    setError('');
    try {
      const current = await localRepo.list(collection);
      if (!current.length) throw new Error('No hay playlists locales que exportar.');
      const backup = await makePlaylistBackupV2(current, `${backupType}s`, { allowRemoteLyrics: false });
      await savePlaylistArchive(backup, isClassical ? 'Música clásica' : 'Music Playlist');
      setMessage(`Copia ZIP v2 exportada (${current.length} playlists).`);
    } catch (cause) { setError(explain(cause)); }
  };

  const exportPlaylist = async item => {
    try {
      const backup = await makePlaylistBackupV2([item], backupType, { single: true, allowRemoteLyrics: false });
      await savePlaylistArchive(backup, item.title || screenTitle);
    } catch (cause) { setError(explain(cause)); }
  };

  const deletePlaylist = async item => {
    const id = String(item.id || item._id);
    const remove = async () => {
      setBusy(true); setError('');
      try {
        await playlistsApi.remove(accessToken, id);
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

  const renderItem = ({ item }) => (
    <CustomYouTubePlaylistPlayer
      playlist={playablePlaylists.get(item)}
      style={styles.playlistCard}
      userName={item.title}
      dateLabel={new Date(item.updatedAt || Date.now()).toLocaleDateString('es-ES')}
      squareArtwork
      isClassical={isClassical}
      showItemCount
      canEdit
      canDelete
      onEdit={() => openEdit(item)}
      onDelete={() => deletePlaylist(item)}
      onExport={() => exportPlaylist(item)}
      onCreateCard={() => setPrintPlaylist(playablePlaylists.get(item))}
    />
  );

  const searchHeader = (
    <View>
      <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
        <View style={styles.searchIcon}><Ionicons name="search-outline" size={21} color="#64748b" /></View>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder={`${searchLabel}…`}
          placeholderTextColor="#64748b"
          accessibilityLabel={searchLabel}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {searchText.length > 0 ? (
          <Pressable onPress={() => setSearchText('')} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" style={styles.searchIcon}>
            <Ionicons name="close-circle" size={21} color="#64748b" />
          </Pressable>
        ) : <View style={styles.searchIcon} />}
      </View>
      {!loading && searchTerms.length > 0 ? (
        <Text style={styles.searchCount} accessibilityLiveRegion="polite">
          {visiblePlaylists.length} de {local.length} {isClassical ? 'colecciones' : 'playlists'}
        </Text>
      ) : null}
    </View>
  );

  if (printPlaylist) {
    return <MusicCardPrintEditor
      playlist={printPlaylist}
      isClassical={isClassical}
      onBack={() => setPrintPlaylist(null)}
    />;
  }

  return <SafeAreaView style={styles.root}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={22} color="#0f172a" /></Pressable><View style={styles.heading}><Text style={styles.title}>{screenTitle}</Text><Text style={styles.subtitle}>Sincronización privada y uso local</Text></View></View>
    <View style={styles.summary}><Text style={styles.summaryText}>Este dispositivo: {local.length} · Node: {remoteCount ?? '—'}</Text><Text style={styles.offlineText}>IndexedDB/almacenamiento local sigue disponible sin conexión.</Text></View>
    <View style={styles.actions}>
      <Pressable disabled={busy} onPress={synchronize} style={[styles.primary, busy && styles.disabled]}><Ionicons name="sync-outline" size={18} color="#fff" /><Text style={styles.primaryText}>{busy ? 'Sincronizando…' : 'Sincronizar'}</Text></Pressable>
      <Pressable disabled={busy} onPress={openCreate} style={styles.secondary}><Ionicons name="add" size={19} color="#1d4ed8" /><Text style={styles.secondaryText}>Nueva</Text></Pressable>
      <Pressable disabled={busy} onPress={exportBackup} style={styles.secondary}><Ionicons name="download-outline" size={18} color="#1d4ed8" /><Text style={styles.secondaryText}>Exportar ZIP</Text></Pressable>
      <Pressable disabled={busy} onPress={pickBackup} style={styles.secondary}><Ionicons name="archive-outline" size={18} color="#1d4ed8" /><Text style={styles.secondaryText}>Importar ZIP/JSON</Text></Pressable>
    </View>
    {message ? <Text style={styles.notice}>{message}</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <FlatList
      data={visiblePlaylists}
      keyExtractor={item => String(item.id || item._id)}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={searchHeader}
      ListEmptyComponent={loading ? (
        <ActivityIndicator style={styles.loadingIndicator} size="large" color="#2563eb" />
      ) : (
        <Text style={styles.empty}>
          {searchTerms.length ? 'No hay resultados para esta búsqueda.' : isClassical
            ? 'No hay colecciones clásicas locales. Importa un ZIP/JSON o crea una colección.'
            : 'No hay playlists musicales locales. Importa un ZIP/JSON o crea una playlist.'}
        </Text>
      )}
      refreshing={loading}
      onRefresh={refresh}
    />
    {pendingImport ? (
      <Modal visible transparent animationType="fade" onRequestClose={() => setPendingImport(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, styles.importDialog]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                <Text style={styles.modalTitle}>Importar {isClassical ? 'colecciones clásicas' : 'playlists'}</Text>
                <Text style={styles.modalSubtitle} numberOfLines={2}>
                  {pendingImport.name} · {pendingImport.playlists.length} {isClassical ? 'colecciones' : 'playlists'}
                </Text>
              </View>
            </View>
            {pendingImport.version === 1 ? (
              <Text style={styles.hint}>El JSON v1 no incluye el contenido de los archivos LRC.</Text>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => importBackup(false)} style={[styles.secondary, styles.importOption]}>
              <Ionicons name="git-merge-outline" size={20} color="#1d4ed8" />
              <View style={styles.modalHeading}>
                <Text style={styles.secondaryText}>Combinar</Text>
                <Text style={styles.hint}>Conserva las listas actuales y añade las del archivo. Omite los duplicados.</Text>
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => importBackup(true)} style={[styles.secondary, styles.importOption, styles.importReplace]}>
              <Ionicons name="trash-outline" size={20} color="#b91c1c" />
              <View style={styles.modalHeading}>
                <Text style={styles.importReplaceTitle}>Reemplazar en este dispositivo</Text>
                <Text style={styles.hint}>
                  Sustituye las listas locales de esta utilidad por las del archivo. Al sincronizar, Node puede volver a descargar sus listas.
                </Text>
              </View>
            </Pressable>
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setPendingImport(null)} style={styles.secondary}>
                <Text style={styles.secondaryText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    ) : null}
    <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={() => !editorBusy && setEditorVisible(false)}>
      <View style={styles.modalBackdrop}><View style={styles.modal}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeading}>
            <Text style={styles.modalTitle}>{isClassical
              ? (editingId ? 'Editar colección clásica' : 'Nueva colección clásica')
              : (editingId ? 'Editar playlist' : 'Nueva playlist')}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar editor" disabled={editorBusy} onPress={() => setEditorVisible(false)} style={styles.closeButton}><Ionicons name="close" size={22} color="#475569" /></Pressable>
        </View>
        {editorError ? <Text accessibilityRole="alert" style={styles.error}>{editorError}</Text> : null}
        <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
          <View style={styles.playlistTitleSection}>
            <Text style={styles.fieldLabel}>{isClassical ? 'Nombre de la colección' : 'Nombre de la playlist'}</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder={isClassical ? 'Ej.: Conciertos para piano' : 'Ej.: Mis canciones favoritas'} style={styles.input} maxLength={120} editable={!editorBusy} />
            {isClassical ? (
              <View style={styles.classicalDetails}>
                {CLASSICAL_FIELDS.map(([key, label]) => (
                  <View key={key} style={styles.classicalField}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <TextInput
                      accessibilityLabel={label}
                      value={classicalDetails[key] || ''}
                      onChangeText={value => setClassicalDetails(details => ({ ...details, [key]: value }))}
                      maxLength={key === 'year' ? 20 : 120}
                      style={styles.input}
                      editable={!editorBusy}
                    />
                  </View>
                ))}
                {worksCount > 0 ? <Text style={styles.hint}>{worksCount} {worksCount === 1 ? 'obra en el catálogo' : 'obras en el catálogo'}</Text> : null}
              </View>
            ) : null}
          </View>
          <View style={styles.trackSectionHeader}><View><Text style={styles.fieldLabel}>{isClassical ? 'Obras y movimientos' : 'Canciones y álbumes'}</Text><Text style={styles.hint}>Añade un vídeo o una playlist de YouTube por elemento.</Text></View><Text style={styles.trackCount}>{tracksDraft.length} / 20</Text></View>
          {tracksDraft.map((track, index) => {
            const pendingLyrics = track.lyrics;
            const original = originalTrackFor(track);
            const originalLyrics = !original?.lyricsDisabled && original?.lyricsFileName;
            const lyricsName = pendingLyrics === undefined ? originalLyrics : pendingLyrics?.fileName;
            const activeLyricsEditor = lyricsEditor?.key === track.key ? lyricsEditor : null;
            const artwork = track.artworkUrl.trim();
            const validArtwork = isPlaylistArtwork(artwork);
            const localArtwork = artwork.startsWith('data:');
            return <View key={track.key} style={styles.trackEditorCard}>
              <View style={styles.trackEditorTop}><View style={styles.trackNumberBadge}><Text style={styles.trackNumberText}>{index + 1}</Text></View><Text style={styles.trackEditorLabel}>ELEMENTO {index + 1}</Text><View style={styles.trackOrderActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Subir elemento" onPress={() => moveDraftTrack(index, -1)} disabled={editorBusy || index === 0} style={styles.orderButton}><Ionicons name="chevron-up" size={19} color={index === 0 ? '#cbd5e1' : '#2563eb'} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Bajar elemento" onPress={() => moveDraftTrack(index, 1)} disabled={editorBusy || index === tracksDraft.length - 1} style={styles.orderButton}><Ionicons name="chevron-down" size={19} color={index === tracksDraft.length - 1 ? '#cbd5e1' : '#2563eb'} /></Pressable>
                {tracksDraft.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Quitar elemento" onPress={() => removeDraftTrack(index)} disabled={editorBusy} style={styles.removeButton}><Ionicons name="trash-outline" size={18} color="#dc2626" /></Pressable> : null}
              </View></View>
              <TextInput value={track.title} onChangeText={value => updateDraftTrack(track.key, 'title', value)} placeholder="Título de la canción o álbum" style={styles.input} maxLength={120} editable={!editorBusy} />
              <TextInput value={track.url} onChangeText={value => updateDraftTrack(track.key, 'url', value)} placeholder="https://www.youtube.com/watch?v=…" style={[styles.input, styles.urlInput]} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!editorBusy} />
              <View style={styles.mediaSection}>
                <Text style={styles.fieldLabel}>Letra (.lrc)</Text>
                {lyricsName ? <Text style={styles.mediaFileName} numberOfLines={1}>{lyricsName}</Text> : null}
                <View style={styles.mediaActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: Boolean(activeLyricsEditor) }}
                    disabled={editorBusy}
                    onPress={() => activeLyricsEditor ? setLyricsEditor(null) : openTrackLyrics(track)}
                    style={styles.secondary}
                  >
                    <Ionicons name="create-outline" size={17} color="#1d4ed8" />
                    <Text style={styles.secondaryText}>{activeLyricsEditor ? 'Ocultar editor' : 'Editar letra .lrc'}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={editorBusy} onPress={() => pickTrackLyrics(track.key)} style={styles.secondary}>
                    <Ionicons name="document-text-outline" size={17} color="#1d4ed8" />
                    <Text style={styles.secondaryText}>{lyricsName ? 'Cambiar archivo .lrc' : 'Añadir archivo .lrc'}</Text>
                  </Pressable>
                  {lyricsName || activeLyricsEditor?.text ? <Pressable accessibilityRole="button" disabled={editorBusy} onPress={() => clearTrackLyrics(track.key)} style={styles.secondary}>
                    <Text style={styles.removeMediaText}>Quitar letra</Text>
                  </Pressable> : null}
                </View>
                {activeLyricsEditor ? <TextInput
                  accessibilityLabel="Contenido del fichero LRC"
                  value={activeLyricsEditor.text}
                  onChangeText={value => changeLyricsText(activeLyricsEditor, value)}
                  placeholder="[00:12.00] Escribe aquí el primer verso"
                  multiline
                  autoCorrect={false}
                  autoCapitalize="none"
                  editable={!editorBusy}
                  style={[styles.input, styles.lyricsTextInput]}
                /> : null}
              </View>
              <View style={styles.mediaSection}>
                <Text style={styles.fieldLabel}>Carátula</Text>
                {!localArtwork ? <TextInput
                  accessibilityLabel="URL HTTPS de la carátula"
                  value={track.artworkUrl}
                  onChangeText={value => updateDraftTrack(track.key, 'artworkUrl', value)}
                  placeholder="https://…/caratula.jpg"
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  editable={!editorBusy}
                /> : null}
                {validArtwork ? <CoverPreview uri={artwork} /> : null}
                {artwork && !validArtwork ? <Text style={styles.coverHint}>Sustituye o quita la carátula dañada.</Text> : null}
                <View style={styles.mediaActions}>
                  <Pressable accessibilityRole="button" disabled={editorBusy} onPress={() => pickTrackArtwork(track.key)} style={styles.secondary}>
                    <Ionicons name="image-outline" size={17} color="#1d4ed8" />
                    <Text style={styles.secondaryText}>Elegir imagen</Text>
                  </Pressable>
                  {artwork ? <Pressable accessibilityRole="button" disabled={editorBusy} onPress={() => updateDraftTrack(track.key, 'artworkUrl', '')} style={styles.secondary}>
                    <Text style={styles.removeMediaText}>Quitar carátula</Text>
                  </Pressable> : null}
                </View>
              </View>
            </View>;
          })}
          {tracksDraft.length < 20 ? <Pressable accessibilityRole="button" onPress={() => setTracksDraft(current => [...current, makeDraft()])} disabled={editorBusy} style={styles.addTrackButton}><Ionicons name="add-circle-outline" size={20} color="#2563eb" /><Text style={styles.addTrackText}>Añadir elemento</Text></Pressable> : null}
        </ScrollView>
        <View style={styles.modalActions}><Pressable disabled={editorBusy} onPress={() => setEditorVisible(false)} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable disabled={editorBusy} onPress={savePlaylist} style={[styles.primary, editorBusy && styles.disabled]}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.primaryText}>{busy ? 'Guardando…' : 'Guardar y sincronizar'}</Text></Pressable></View>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  importDialog: { maxWidth: 520 },
  importOption: { justifyContent: 'flex-start', alignItems: 'flex-start', paddingVertical: 10, gap: 9, marginTop: 8 },
  importReplace: { borderColor: '#fecaca' },
  importReplaceTitle: { color: '#b91c1c', fontWeight: '700' },
  classicalDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  classicalField: { flexBasis: 210, flexGrow: 1, minWidth: 0 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  searchBarFocused: { borderColor: '#475569' },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    fontSize: 15,
    color: '#111827',
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  searchIcon: { width: 44, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  searchCount: { marginTop: 6, color: '#475569', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  list: { width: '100%', maxWidth: 704, alignSelf: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  playlistCard: { width: '100%' },
  loadingIndicator: { marginTop: 20 },
  mediaSection: { marginTop: 14 },
  mediaActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaFileName: { color: '#475569', marginBottom: 8 },
  coverPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  coverPreview: { width: 88, height: 88 },
  coverDimensions: { color: '#475569', fontSize: 13 },
  coverHint: { color: '#475569', marginBottom: 8, fontSize: 12 },
  lyricsTextInput: {
    minHeight: 160,
    marginTop: 10,
    textAlignVertical: 'top',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
  },
  removeMediaText: { color: '#b91c1c', fontWeight: '700' },
  root: { flex: 1, backgroundColor: '#f8fafc' }, header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' }, back: { padding: 8 }, heading: { flex: 1 }, title: { color: '#0f172a', fontSize: 20, fontWeight: '800' }, subtitle: { color: '#64748b', marginTop: 3, fontSize: 12 }, summary: { padding: 14, backgroundColor: '#eff6ff', borderBottomWidth: 1, borderBottomColor: '#dbeafe' }, summaryText: { color: '#1e3a8a', fontWeight: '800' }, offlineText: { marginTop: 4, color: '#475569', fontSize: 12 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 }, primary: { minHeight: 42, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 14 }, primaryText: { color: '#fff', fontWeight: '800' }, secondary: { minHeight: 42, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12 }, secondaryText: { color: '#1d4ed8', fontWeight: '700' }, disabled: { opacity: .55 }, notice: { marginHorizontal: 12, marginBottom: 8, color: '#166534', backgroundColor: '#f0fdf4', padding: 10, borderRadius: 8, lineHeight: 19 }, error: { marginHorizontal: 12, marginBottom: 8, color: '#991b1b', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, lineHeight: 19 }, card: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 12, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }, cardText: { flex: 1 }, cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' }, cardMeta: { color: '#64748b', fontSize: 12, marginTop: 4 }, iconButton: { padding: 8 }, empty: { textAlign: 'center', color: '#64748b', lineHeight: 22, padding: 24 }, modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a88', padding: 16 }, modal: { width: '100%', maxWidth: 880, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 18, padding: 20, overflow: 'hidden' }, modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 14, marginBottom: 16 }, modalHeading: { flex: 1 }, modalTitle: { color: '#0f172a', fontSize: 22, fontWeight: '800' }, modalSubtitle: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 4 }, closeButton: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }, editorScroll: { flexShrink: 1, minHeight: 100 }, editorContent: { paddingBottom: 4 }, playlistTitleSection: { marginBottom: 16 }, fieldLabel: { color: '#334155', fontSize: 14, fontWeight: '800', marginBottom: 7 }, trackSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, trackCount: { color: '#64748b', fontSize: 12, fontWeight: '700' }, trackEditorCard: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 }, trackEditorTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }, trackNumberBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }, trackNumberText: { color: '#1d4ed8', fontSize: 12, fontWeight: '800' }, trackEditorLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', flex: 1, letterSpacing: .4 }, trackOrderActions: { flexDirection: 'row', alignItems: 'center', gap: 2 }, orderButton: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, removeButton: { width: 34, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, addTrackButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#93c5fd', backgroundColor: '#eff6ff', borderRadius: 11 }, addTrackText: { color: '#1d4ed8', fontWeight: '800' }, input: { minHeight: 44, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, color: '#0f172a', marginBottom: 9, fontSize: 14 }, urlInput: { marginBottom: 0 }, hint: { color: '#64748b', fontSize: 12, lineHeight: 18 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 14, marginTop: 14 },
});
