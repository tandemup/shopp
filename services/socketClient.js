import { io } from "socket.io-client";

import { SOCKET_SERVER_URL } from "../config/env";

let socketInstance = null;

export function getSocket() {
  if (!SOCKET_SERVER_URL) {
    return null;
  }

  if (!socketInstance) {
    socketInstance = io(SOCKET_SERVER_URL, {
      transports: ["websocket", "polling"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 15000,
    });
  }

  return socketInstance;
}

export function connectSocket() {
  const socket = getSocket();

  if (socket && !socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socketInstance?.connected) {
    socketInstance.disconnect();
  }
}
