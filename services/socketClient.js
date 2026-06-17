import { io } from "socket.io-client";

import { SOCKET_SERVER_URL } from "../config/env";

export const socket = io(SOCKET_SERVER_URL, {
  transports: ["websocket", "polling"],
  autoConnect: false,

  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 15000,
});
