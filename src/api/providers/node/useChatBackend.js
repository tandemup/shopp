import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { nodeChatApi, nodeChatMediaUrl } from './chat';

const ChatContext = createContext(null);

export function NodeChatProvider({ accessToken, children }) {
  const socketRef = useRef(null);
  const roomRef = useRef(null);
  const revisionTimer = useRef(null);
  const [revision, setRevision] = useState(0);
  const [historyError, setHistoryError] = useState(null);
  const invalidate = useCallback(() => {
    if (revisionTimer.current) return;
    revisionTimer.current = setTimeout(() => {
      revisionTimer.current = null;
      setRevision(value => value + 1);
    }, 120);
  }, []);

  const watchRoom = useCallback(room => {
    roomRef.current = room;
    const socket = socketRef.current;
    if (socket?.readyState === 1) {
      socket.send(JSON.stringify({ type: 'subscribe', rooms: room ? ['global', room] : ['global'] }));
      invalidate();
    }
  }, [invalidate]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    let reconnectTimer;
    let connectTimer;
    let retry = 1_000;
    let socket;
    const reconnect = () => {
      if (!active || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        void connect();
      }, retry);
      retry = Math.min(retry * 2, 30_000);
    };
    const connect = async () => {
      try {
        socket = await nodeChatApi.connect(accessToken);
        if (!active) { socket.close(); return; }
        socketRef.current = socket;
        connectTimer = setTimeout(() => socket.close(), 12_000);
        socket.onopen = () => {
          if (!active) return;
          clearTimeout(connectTimer);
          retry = 1_000;
          watchRoom(roomRef.current);
        };
        socket.onmessage = event => {
          if (!active) return;
          try {
            const { type, room } = JSON.parse(event.data);
            if (type?.startsWith('chat.') && (room === 'global' || room === roomRef.current)) invalidate();
          } catch {}
        };
        socket.onerror = () => socket.close();
        socket.onclose = () => {
          clearTimeout(connectTimer);
          if (socketRef.current === socket) socketRef.current = null;
          reconnect();
        };
      } catch { reconnect(); }
    };
    void connect();
    // Recupera el historial también si se pierde alguna notificación.
    const poll = setInterval(invalidate, 30_000);
    return () => {
      active = false;
      clearInterval(poll);
      clearTimeout(reconnectTimer);
      clearTimeout(connectTimer);
      clearTimeout(revisionTimer.current);
      revisionTimer.current = null;
      socketRef.current = null;
      socket?.close();
    };
  }, [accessToken, invalidate, watchRoom]);

  const context = useMemo(() => ({
    accessToken, revision, invalidate, watchRoom, historyError, setHistoryError,
  }), [accessToken, revision, invalidate, watchRoom, historyError]);

  return <ChatContext.Provider value={context}>{children}</ChatContext.Provider>;
}

function useChatResource(key, load, reportError) {
  const { accessToken, revision } = useContext(ChatContext);
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!key || !accessToken) return;
    const controller = new AbortController();
    load(accessToken, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      reportError?.(null);
      setSnapshot({ key, accessToken, result });
    }).catch(error => {
      if (!controller.signal.aborted) reportError?.(error.message);
    });
    return () => controller.abort();
  }, [key, load, reportError, accessToken, revision]);
  return key && snapshot?.key === key && snapshot.accessToken === accessToken ? snapshot.result : undefined;
}

function decorate(message) {
  const album = message.youtubeAlbum;
  const playlist = message.customYouTubePlaylist;
  const withUri = item => ({ ...item, uri: nodeChatMediaUrl(item.uri) });
  return {
    ...message,
    _id: message._id || message.id,
    images: message.images?.map(withUri),
    files: message.files?.map(withUri),
    youtubeAlbum: album && { ...album, thumbnailUri: nodeChatMediaUrl(album.thumbnailUri), lyricsUri: nodeChatMediaUrl(album.lyricsUri) },
    customYouTubePlaylist: playlist && {
      ...playlist,
      tracks: playlist.tracks.map(track => ({ ...track, lyricsUri: nodeChatMediaUrl(track.lyricsUri) })),
    },
  };
}

export function useChatMessagesBackend(args) {
  const room = args === 'skip' ? null : args?.room || 'compras';
  const limit = args?.limit || 200;
  const { watchRoom, setHistoryError } = useContext(ChatContext);
  useEffect(() => {
    setHistoryError(null);
    watchRoom(room);
    return () => watchRoom(null);
  }, [room, watchRoom, setHistoryError]);
  const load = useCallback(async (token, signal) => {
    const data = await nodeChatApi.listMessages(token, { room, limit, signal });
    return data.messages.map(decorate);
  }, [room, limit]);
  return useChatResource(room && room + ':' + limit, load, setHistoryError);
}

export function useChatRoomSummariesBackend(args) {
  const load = useCallback((token, signal) => nodeChatApi.listRooms(token, signal), []);
  return useChatResource(args === 'skip' ? null : 'rooms', load);
}

export function useChatReadErrorBackend() {
  return useContext(ChatContext).historyError;
}

function useActions() {
  const { accessToken, invalidate } = useContext(ChatContext);
  return useMemo(() => {
    const mutation = fn => async args => {
      const result = await fn(accessToken, args);
      invalidate();
      return result;
    };
    return {
      sendMessage: mutation(nodeChatApi.sendMessage),
      deleteMessage: mutation((token, { messageId }) => nodeChatApi.deleteMessage(token, messageId)),
      deleteRoomMutation: mutation((token, { room }) => nodeChatApi.deleteRoom(token, room)),
      createRoom: mutation((token, label) => nodeChatApi.createRoom(token, label, true)),
      createCustomYouTubePlaylist: mutation(nodeChatApi.createYouTubePlaylist),
      updateCustomYouTubePlaylist: mutation(nodeChatApi.updateYouTubePlaylist),
      updateYouTubeAlbum: mutation(nodeChatApi.updateYouTubeAlbum),
      shareLocalPlaylist: mutation(nodeChatApi.sharePlaylist),
      refreshNewsYouTubePublishedDates: mutation(nodeChatApi.refreshNews),
      getSharedPlaylist: messageId => nodeChatApi.getSharedPlaylist(accessToken, messageId),
      generateImageUploadUrl: () => nodeChatApi.getUploadUrl(accessToken),
    };
  }, [accessToken, invalidate]);
}

export const useChatBasicActionsBackend = useActions;
export const useChatMediaActionsBackend = useActions;
export const useChatExtendedActionsBackend = useActions;
