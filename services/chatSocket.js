{
  /*
import { io } from "socket.io-client";

const SOCKET_SERVER_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL?.trim() || "http://localhost:3001";

export const chatSocket = io(SOCKET_SERVER_URL.replace(/\/+$/, ""), {
  transports: ["websocket", "polling"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

export default chatSocket;
 */
}

import { io } from "socket.io-client";
export const chatSocket = io("http://localhost:3000");
