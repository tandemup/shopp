/**
 * Contrato de chat para la migración a Express + Socket.IO.
 * Estado: undefined (pendiente), array (historial), null (sin datos).
 * Los IDs y metadatos existentes se preservan hasta migrar los datos.
 *
 * Query listMessages({room, clientId?, latitude?, longitude?}) o "skip".
 * Query listRoomSummaries({rooms, clientId}) o "skip".
 * Mutaciones: sendMessage(payload), deleteMessage(payload), deleteRoom(payload).
 * Media: generateImageUploadUrl(), updateYouTubeAlbum(payload).
 * Compartir: shareLocalPlaylist(payload), getSharedPlaylist(messageId).
 * Una futura adaptación Socket.IO debe disponer de unsubscribe, reconexión,
 * recuperación de historial y filtrado/autorización de sala en el servidor.
 */
export const CHAT_EVENTS = Object.freeze({
  MESSAGE_CREATED: "chat:message_created",
  MESSAGE_DELETED: "chat:message_deleted",
  ROOM_UPDATED: "chat:room_updated",
  ROOM_DELETED: "chat:room_deleted",
});
