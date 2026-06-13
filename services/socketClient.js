import { io } from "socket.io-client";

const SOCKET_SERVER_URL = "https://shopp-sockets-a0c7e4757da5.herokuapp.com/";

export const socket = io(SOCKET_SERVER_URL, {
  transports: ["websocket", "polling"],
  autoConnect: false,
  reconnection: true,
});
