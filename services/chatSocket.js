// services/chatSocket.js
import { io } from "socket.io-client";

const CHAT_SERVER_URL =
  process.env.EXPO_PUBLIC_CHAT_SERVER_URL || "http://localhost:4000";

export const chatSocket = io(CHAT_SERVER_URL, {
  transports: ["websocket", "polling"],
  autoConnect: false,
});

export default chatSocket;
