import { useCallback } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Adaptador de Chat de Convex. Mantiene la semántica reactiva de useQuery:
 * undefined = cargando, array = historial, "skip" = sin suscripción.
 * La futura implementación Socket.IO deberá conservar este contrato.
 */
export function useChatMessagesBackend(args) {
  return useQuery(api.chat.listMessages, args);
}

export function useChatRoomSummariesBackend(args) {
  return useQuery(api.chat.listRoomSummaries, args);
}

export function useChatBasicActionsBackend() {
  const sendMessage = useMutation(api.chat.sendMessage);
  const deleteMessage = useMutation(api.chat.deleteMessage);
  return { sendMessage, deleteMessage };
}

export function useChatMediaActionsBackend() {
  const generateImageUploadUrl = useMutation(api.chat.generateImageUploadUrl);
  const updateYouTubeAlbum = useMutation(api.chat.updateYouTubeAlbum);
  return { generateImageUploadUrl, updateYouTubeAlbum };
}

export function useChatExtendedActionsBackend() {
  const deleteRoomMutation = useMutation(api.chat.deleteRoom);
  const createCustomYouTubePlaylist = useMutation(api.chat.createCustomYouTubePlaylist);
  const updateCustomYouTubePlaylist = useMutation(api.chat.updateCustomYouTubePlaylist);
  const shareLocalPlaylist = useMutation(api.chat.shareLocalPlaylist);
  const refreshNewsYouTubePublishedDates = useAction(api.chat.refreshNewsYouTubePublishedDates);
  const client = useConvex();
  const getSharedPlaylist = useCallback(
    (messageId) => client.query(api.chat.getSharedPlaylist, { messageId }),
    [client],
  );
  return {
    deleteRoomMutation,
    createCustomYouTubePlaylist,
    updateCustomYouTubePlaylist,
    shareLocalPlaylist,
    refreshNewsYouTubePublishedDates,
    getSharedPlaylist,
  };
}
