const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT || 3001);
const MAX_HISTORY = 100;

const configuredOrigins = String(process.env.CLIENT_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function isOriginAllowed(origin) {
  // Expo Go y las aplicaciones nativas normalmente no envían Origin.
  if (!origin) return true;

  // En desarrollo inicial, una lista vacía permite cualquier origen.
  if (configuredOrigins.length === 0) return true;

  return configuredOrigins.includes(origin.replace(/\/+$/, ""));
}

function corsOrigin(origin, callback) {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origen no permitido: ${origin}`));
}

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: corsOrigin, methods: ["GET", "POST"] }));
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Historial temporal. Se pierde al reiniciar el dyno.
const historyByRoom = new Map();

function normalizeRoomId(value) {
  return String(value || "").trim();
}

function getRoomHistory(roomId) {
  return historyByRoom.get(roomId) || [];
}

app.get("/", (_request, response) => {
  response.json({
    ok: true,
    service: "shopp-chat-server",
    socketIo: true,
  });
});

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    connectedClients: io.engine.clientsCount,
  });
});

io.on("connection", (socket) => {
  console.log("Socket conectado:", socket.id);

  socket.on("room:join", (payload = {}, callback) => {
    const roomId = normalizeRoomId(payload.roomId);

    if (!roomId || roomId.length > 100) {
      callback?.({ ok: false, error: "roomId no válido" });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit("room:history", {
      roomId,
      messages: getRoomHistory(roomId),
    });

    callback?.({ ok: true, roomId });
  });

  socket.on("message:send", (payload = {}, callback) => {
    const roomId = normalizeRoomId(payload.roomId);
    const userId = String(payload.userId || "").trim();
    const userName = String(payload.userName || "Anónimo").trim() || "Anónimo";
    const text = String(payload.text || "").trim();

    if (!roomId || roomId.length > 100) {
      callback?.({ ok: false, error: "roomId no válido" });
      return;
    }

    if (!userId || userId.length > 100) {
      callback?.({ ok: false, error: "userId no válido" });
      return;
    }

    if (!text || text.length > 1000) {
      callback?.({ ok: false, error: "Mensaje vacío o demasiado largo" });
      return;
    }

    const message = {
      id: `${Date.now()}-${socket.id}`,
      roomId,
      userId,
      userName,
      text,
      createdAt: new Date().toISOString(),
    };

    const nextHistory = [...getRoomHistory(roomId), message].slice(-MAX_HISTORY);
    historyByRoom.set(roomId, nextHistory);

    io.to(roomId).emit("message:new", message);
    callback?.({ ok: true, message });
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket desconectado:", socket.id, reason);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Shopp Chat escuchando en el puerto ${PORT}`);
  console.log(
    configuredOrigins.length
      ? `Orígenes web permitidos: ${configuredOrigins.join(", ")}`
      : "CLIENT_ORIGINS vacío: CORS abierto para la prueba inicial",
  );
});
