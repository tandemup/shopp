import { io } from "socket.io-client";

const CHAT_SERVER_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  "https://shopp-chat-server.herokuapp.com";

let socket = null;

export function getChatSocket() {
  if (!socket) {
    socket = io(CHAT_SERVER_URL, {
      transports: ["websocket", "polling"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }

  return socket;
}

export function connectChatSocket() {
  const currentSocket = getChatSocket();

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
