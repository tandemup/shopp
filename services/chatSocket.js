import { io } from "socket.io-client";

import { SOCKET_SERVER_URL } from "@/config/env";

let socket = null;

export function getChatSocket() {
  if (!SOCKET_SERVER_URL) {
    console.warn("No hay SOCKET_SERVER_URL configurada para el chat.");
    return null;
  }

  if (!socket) {
    socket = io(SOCKET_SERVER_URL, {
      transports: ["websocket", "polling"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
  }

  return socket;
}

export function connectChatSocket() {
  const currentSocket = getChatSocket();

  if (!currentSocket) {
    return null;
  }

  if (!currentSocket.connected) {
    currentSocket.connect();
  }

  return currentSocket;
}

export function disconnectChatSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export default {
  getChatSocket,
  connectChatSocket,
  disconnectChatSocket,
};
