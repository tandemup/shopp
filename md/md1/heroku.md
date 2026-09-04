ChatGPT

Tengo una cuenta de heroku. Me puedes ayudar a crear una base de datos y un servidor de sockets

Voy a darte una ruta completa para dejarlo funcionando en Heroku: base de datos PostgreSQL, servidor Node.js con Socket.IO y una prueba mínima desde Expo o web.

La opción más sencilla para empezar es un único web dyno con Express + Socket.IO y PostgreSQL gestionado por Heroku. Para tu escala inicial no necesitas Redis; lo reservaría para cuando ejecutes varias instancias del servidor.

Pensó durante 44s
Sí. Para empezar, te recomiendo crear un backend independiente para Shopp con esta arquitectura:

App Expo / Web Netlify
│
│ HTTPS + Socket.IO
▼
Servidor Node.js en Heroku
│
│ SQL
▼
Heroku Postgres
En el móvil puedes seguir utilizando SQLite o AsyncStorage para trabajar sin conexión. PostgreSQL actuaría como base de datos central para sincronizar información entre dispositivos y usuarios. No debes utilizar SQLite dentro del servidor de Heroku: el sistema de archivos de los dynos es efímero y los ficheros locales se pierden cuando el contenedor se reemplaza. Heroku recomienda utilizar una base de datos gestionada como Heroku Postgres.

Para menos de 100 usuarios, empieza con un único servidor Socket.IO. No necesitas Redis inicialmente.

1. Instalar la CLI de Heroku
   En tu Mac:

brew install heroku/brew/heroku
heroku login
El segundo comando abrirá el navegador para iniciar sesión en tu cuenta de Heroku. La CLI permite crear aplicaciones, añadir bases de datos y consultar los logs.

2. Crear el proyecto del servidor
   No mezcles inicialmente el servidor con el código de Expo. Crea una carpeta independiente:

mkdir shopp-socket-server
cd shopp-socket-server

npm init -y
npm install express cors pg socket.io
Socket.IO proporciona comunicación bidireccional basada normalmente en WebSockets, reconexión automática y fallback a HTTP long-polling cuando WebSocket no está disponible.

Configura el arranque y una versión moderna de Node.js:

npm pkg set scripts.start="node server.js"
npm pkg set engines.node="22.x"
Heroku utiliza actualmente Node.js 22.x en su tutorial oficial de WebSockets.

3. Crear el servidor Socket.IO
   Crea el archivo server.js:

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;

/\*\*

- Durante la primera prueba puedes dejar CLIENT_ORIGIN sin definir.
- En producción debes configurarlo con tu dominio de Netlify.
  _/
  const configuredOrigins = String(process.env.CLIENT_ORIGIN || "_")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const corsOrigin = configuredOrigins.includes("_")
? "_"
: configuredOrigins;

/\*\*

- Heroku Postgres proporciona DATABASE_URL automáticamente.
- Heroku exige conexiones SSL a PostgreSQL.
  \*/
  const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
  process.env.PGSSL === "true"
  ? {
  rejectUnauthorized: false,
  }
  : false,
  });

const app = express();

app.use(
cors({
origin: corsOrigin,
methods: ["GET", "POST"],
}),
);

app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
cors: {
origin: corsOrigin,
methods: ["GET", "POST"],
},
});

/\*\*

- Crea las tablas necesarias al iniciar el servidor.
  \*/
  async function initializeDatabase() {
  await pool.query(`     CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      room_id VARCHAR(100) NOT NULL,
      user_id VARCHAR(100) NOT NULL,
      text VARCHAR(1000) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

await pool.query(`     CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
    ON chat_messages (room_id, created_at DESC);
  `);

console.log("Base de datos inicializada");
}

/\*\*

- Endpoint HTTP de comprobación.
  \*/
  app.get("/", (req, res) => {
  res.json({
  ok: true,
  service: "shopp-socket-server",
  });
  });

app.get("/health", async (req, res) => {
try {
const result = await pool.query("SELECT NOW() AS server_time");

    res.json({
      ok: true,
      database: "connected",
      serverTime: result.rows[0].server_time,
    });

} catch (error) {
console.error("Error comprobando PostgreSQL:", error);

    res.status(500).json({
      ok: false,
      database: "disconnected",
    });

}
});

/\*\*

- Servidor de sockets.
  \*/
  io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

/\*\*

- El cliente entra en una sala.
- Ejemplo: { roomId: "general" }
  \*/
  socket.on("room:join", async (payload = {}, callback) => {
  try {
  const roomId = String(payload.roomId || "").trim();

      if (!roomId || roomId.length > 100) {
        throw new Error("roomId no válido");
      }

      socket.join(roomId);

      const result = await pool.query(
        `
          SELECT
            id,
            room_id AS "roomId",
            user_id AS "userId",
            text,
            created_at AS "createdAt"
          FROM chat_messages
          WHERE room_id = $1
          ORDER BY created_at DESC
          LIMIT 50
        `,
        [roomId],
      );

      const messages = result.rows.reverse();

      socket.emit("room:history", {
        roomId,
        messages,
      });

      if (typeof callback === "function") {
        callback({
          ok: true,
          roomId,
        });
      }

  } catch (error) {
  console.error("Error entrando en sala:", error);

      if (typeof callback === "function") {
        callback({
          ok: false,
          error: error.message,
        });
      }

  }
  });

/\*\*

- Envía y almacena un mensaje.
- Ejemplo:
- {
- roomId: "general",
- userId: "usuario-1",
- text: "Hola"
- }
  \*/
  socket.on("message:send", async (payload = {}, callback) => {
  try {
  const roomId = String(payload.roomId || "").trim();
  const userId = String(payload.userId || "").trim();
  const text = String(payload.text || "").trim();

      if (!roomId || roomId.length > 100) {
        throw new Error("roomId no válido");
      }

      if (!userId || userId.length > 100) {
        throw new Error("userId no válido");
      }

      if (!text || text.length > 1000) {
        throw new Error("Mensaje vacío o demasiado largo");
      }

      const result = await pool.query(
        `
          INSERT INTO chat_messages (room_id, user_id, text)
          VALUES ($1, $2, $3)
          RETURNING
            id,
            room_id AS "roomId",
            user_id AS "userId",
            text,
            created_at AS "createdAt"
        `,
        [roomId, userId, text],
      );

      const message = result.rows[0];

      io.to(roomId).emit("message:new", message);

      if (typeof callback === "function") {
        callback({
          ok: true,
          message,
        });
      }

  } catch (error) {
  console.error("Error enviando mensaje:", error);

      if (typeof callback === "function") {
        callback({
          ok: false,
          error: error.message,
        });
      }

  }
  });

socket.on("disconnect", (reason) => {
console.log("Cliente desconectado:", socket.id, reason);
});
});

async function startServer() {
try {
await initializeDatabase();

    httpServer.listen(PORT, () => {
      console.log(`Servidor escuchando en el puerto ${PORT}`);
    });

} catch (error) {
console.error("No se pudo iniciar el servidor:", error);
process.exit(1);
}
}

async function shutdown() {
console.log("Cerrando servidor...");

httpServer.close(async () => {
await pool.end();
process.exit(0);
});
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startServer();
El servidor escucha el puerto asignado dinámicamente mediante process.env.PORT. Esto es obligatorio en Heroku.

Las consultas SQL utilizan parámetros como $1, $2 y $3. No concatena textos introducidos por el usuario, lo que reduce el riesgo de inyección SQL. Heroku recomienda validar los datos recibidos también cuando llegan mediante WebSockets.

4. Añadir los archivos auxiliares
   Crea .gitignore:

node_modules
.env
.DS_Store
Crea un archivo llamado exactamente Procfile, sin extensión:

web: node server.js
El proceso debe llamarse web, porque es el proceso que recibe tráfico HTTP externo en Heroku. El mismo servidor HTTP se utiliza también como soporte para Socket.IO.

5. Crear la aplicación y la base de datos en Heroku
   Inicializa Git:

git init
git add .
git commit -m "Create Shopp Socket.IO server"
Crea la aplicación. El nombre debe ser único en Heroku:

heroku create shopp-sockets-tu-alias
Por ejemplo:

heroku create shopp-sockets-jn
Añade PostgreSQL:

heroku addons:create heroku-postgresql:essential-0
Espera hasta que esté disponible:

heroku pg:wait
Comprueba los recursos creados:

heroku addons
El plan essential-0 es apropiado como punto de partida para una aplicación pequeña. La documentación actual de Heroku muestra un límite aproximado de 5 dólares mensuales para este plan. Al provisionarlo, Heroku crea automáticamente la variable de entorno DATABASE_URL.

Activa SSL para la conexión PostgreSQL:

heroku config:set PGSSL=true
Heroku Postgres exige conexiones SSL con TLS 1.2 o superior.

Sube el servidor:

git push heroku main
Consulta los logs:

heroku logs --tail
Deberías ver algo parecido a:

Base de datos inicializada
Servidor escuchando en el puerto 12345 6. Probar el servidor
Consulta el endpoint de comprobación:

heroku open
También puedes obtener el dominio con:

heroku info
La ruta /health debería devolver algo parecido a:

{
"ok": true,
"database": "connected",
"serverTime": "2026-06-13T..."
} 7. Conectar tu aplicación Expo
Dentro del proyecto Expo de Shopp instala el cliente:

npm install socket.io-client
Socket.IO mantiene un paquete específico para el cliente JavaScript.

Crea, por ejemplo:

services/socketClient.js
Contenido:

import { io } from "socket.io-client";

const SOCKET_SERVER_URL =
"https://shopp-sockets-tu-alias.herokuapp.com";

export const socket = io(SOCKET_SERVER_URL, {
transports: ["websocket", "polling"],
autoConnect: false,
reconnection: true,
});
Utiliza siempre https:// en producción. Socket.IO negociará una conexión segura. Heroku recomienda utilizar wss:// frente a ws:// cuando se usan WebSockets directamente, porque WSS cifra el tráfico mediante TLS.

Un componente React Native mínimo para probar el chat podría ser:

import React, { useEffect, useState } from "react";
import {
View,
Text,
TextInput,
Pressable,
FlatList,
} from "react-native";

import { socket } from "./services/socketClient";

const ROOM_ID = "general";
const USER_ID = "usuario-prueba";

export default function SocketChatTest() {
const [connected, setConnected] = useState(false);
const [text, setText] = useState("");
const [messages, setMessages] = useState([]);

useEffect(() => {
socket.connect();

    function handleConnect() {
      setConnected(true);

      socket.emit("room:join", {
        roomId: ROOM_ID,
      });
    }

    function handleDisconnect() {
      setConnected(false);
    }

    function handleHistory(payload) {
      setMessages(payload.messages || []);
    }

    function handleNewMessage(message) {
      setMessages((current) => [...current, message]);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:history", handleHistory);
    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:history", handleHistory);
      socket.off("message:new", handleNewMessage);

      socket.disconnect();
    };

}, []);

function handleSend() {
const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    socket.emit(
      "message:send",
      {
        roomId: ROOM_ID,
        userId: USER_ID,
        text: cleanText,
      },
      (response) => {
        if (!response?.ok) {
          console.error("No se pudo enviar:", response?.error);
          return;
        }

        setText("");
      },
    );

}

return (
<View style={{ flex: 1, padding: 20 }}>
<Text>
Estado: {connected ? "conectado" : "desconectado"}
</Text>

      <FlatList
        data={messages}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={{ paddingVertical: 6 }}>
            {item.userId}: {item.text}
          </Text>
        )}
      />

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Escribe un mensaje"
        style={{
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          marginBottom: 8,
        }}
      />

      <Pressable
        onPress={handleSend}
        style={{
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
        }}
      >
        <Text>Enviar</Text>
      </Pressable>
    </View>

);
} 8. Restringir el acceso desde Netlify
Durante la primera prueba el servidor acepta cualquier origen. Cuando funcione correctamente, limita el acceso al dominio de tu aplicación:

heroku config:set CLIENT_ORIGIN=https://tu-app.netlify.app
También puedes admitir varios dominios separados por comas:

heroku config:set CLIENT_ORIGIN=https://tu-app.netlify.app,http://localhost:8081
Esto no sustituye a un sistema de autenticación. Antes de utilizarlo con usuarios reales conviene añadir tokens de acceso, por ejemplo JWT, y verificar el token durante la conexión de Socket.IO. WebSocket no incorpora autenticación automáticamente.

9. Cuándo añadir Redis
   Mientras utilices un solo web dyno, Socket.IO puede mantener las conexiones y las salas en memoria.

Redis será necesario cuando escales horizontalmente:

heroku ps:scale web=2
Con dos o más servidores, algunos usuarios quedarán conectados a una instancia y otros a otra. Para distribuir correctamente los eventos entre servidores necesitas un adaptador compartido, como @socket.io/redis-adapter. Socket.IO utiliza Redis Pub/Sub para reenviar mensajes entre nodos.

En Heroku el servicio se denomina actualmente Heroku Key-Value Store, aunque mantiene comandos compatibles con Redis.

Para crear una instancia pequeña más adelante:

heroku addons:create heroku-redis:mini
Con varias instancias Socket.IO también debes activar afinidad de sesión:

heroku features:enable http-session-affinity
Heroku recomienda esta configuración para aplicaciones en tiempo real ejecutadas con varios dynos.

Aplicación posterior en Shopp
Este primer servidor implementa un chat porque permite verificar fácilmente que los sockets y PostgreSQL funcionan. Después puedes utilizar la misma infraestructura para eventos propios de Shopp:

socket.emit("price:updated", {
barcode: "8410123456789",
storeId: "mercadona-centro",
price: 2.35,
});
El servidor podría validar y almacenar el precio en PostgreSQL y emitir la actualización a los usuarios interesados:

io.to(`store:${storeId}`).emit("price:new", savedPrice);
Así puedes construir progresivamente sincronización de listas, precios compartidos, avisos de ofertas y actualizaciones en tiempo real sin modificar la arquitectura inicial.

Puedes ayudarme a crear una prueba de la base de datos con heroku

Voy a darte una prueba mínima, reproducible y segura para verificar que Heroku Postgres está creado, acepta conexiones y permite insertar y leer datos.

Pensó durante 9s
Vamos a crear una base de datos PostgreSQL de prueba en Heroku y comprobarla directamente desde la terminal. Todavía no necesitas desplegar el servidor de sockets.

Usaremos una aplicación independiente llamada, por ejemplo:

shopp-db-test
El nombre de la aplicación debe ser único en Heroku. Si ya has creado una aplicación para el servidor de sockets, sustituye shopp-db-test por su nombre y omite el paso de creación.

1. Comprobar la CLI de Heroku
   En tu Mac, abre Terminal y ejecuta:

heroku --version
Si el comando no existe:

brew install heroku/brew/heroku
Inicia sesión:

heroku login
Se abrirá el navegador para identificarte con tu cuenta.

2. Crear una aplicación vacía en Heroku
   Ejecuta:

heroku create shopp-db-test
Si el nombre ya está ocupado, utiliza otro, por ejemplo:

heroku create shopp-db-test-jn
No es necesario subir código para realizar esta primera prueba. La aplicación funcionará inicialmente como contenedor administrativo de la base de datos.

3. Crear la base de datos PostgreSQL
   Ejecuta:

heroku addons:create heroku-postgresql:essential-0 -a shopp-db-test
Sustituye shopp-db-test por el nombre real de tu aplicación.

Heroku añadirá una variable de configuración denominada DATABASE_URL. Esa variable contiene la dirección del servidor, el puerto, el usuario, la contraseña y el nombre de la base de datos. Cuando una aplicación tiene una única base de datos, Heroku la asigna automáticamente como base de datos principal.

Comprueba el estado:

heroku pg:info -a shopp-db-test
También puedes comprobar los complementos asociados a la aplicación:

heroku addons -a shopp-db-test 4. Instalar el cliente PostgreSQL si fuera necesario
La orden heroku pg:psql utiliza el terminal interactivo psql. Heroku indica que PostgreSQL debe estar instalado localmente para poder utilizarla.

Comprueba si ya lo tienes:

psql --version
Si aparece una versión, continúa con el siguiente apartado.

Si no aparece, instala PostgreSQL con Homebrew:

brew install postgresql@17
Añade los ejecutables a tu sesión actual:

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
Comprueba de nuevo:

psql --version
Para conservar esa configuración cuando abras una nueva terminal:

echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc 5. Abrir la base de datos desde la terminal
Conéctate:

heroku pg:psql -a shopp-db-test
Heroku utiliza por defecto la base de datos principal referenciada por DATABASE_URL. La orden heroku pg:psql abre una sesión interactiva sobre esa base de datos remota.

Verás un prompt parecido a este:

shopp-db-test::DATABASE=> 6. Crear una tabla de productos
Copia y pega este bloque dentro de psql:

CREATE TABLE products (
id BIGSERIAL PRIMARY KEY,
barcode VARCHAR(32) NOT NULL UNIQUE,
name VARCHAR(200) NOT NULL,
price NUMERIC(10, 2),
store VARCHAR(120),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
PostgreSQL debería responder:

CREATE TABLE
Comprueba que la tabla existe:

\dt
Deberías ver una tabla denominada:

products 7. Insertar datos de prueba
Inserta tres productos:

INSERT INTO products (barcode, name, price, store)
VALUES
('8410123456789', 'Leche entera', 1.15, 'Supermercado Centro'),
('8480000590135', 'Arroz largo', 1.79, 'Supermercado Centro'),
('8000500310427', 'Crema de cacao', 3.25, 'Tienda Barrio');
PostgreSQL debería responder:

INSERT 0 3 8. Leer los productos almacenados
Ejecuta:

SELECT id, barcode, name, price, store, created_at
FROM products
ORDER BY id;
El resultado será parecido a este:

id | barcode | name | price | store
----+---------------+-----------------+-------+---------------------
1 | 8410123456789 | Leche entera | 1.15 | Supermercado Centro
2 | 8480000590135 | Arroz largo | 1.79 | Supermercado Centro
3 | 8000500310427 | Crema de cacao | 3.25 | Tienda Barrio
Busca un producto por código de barras:

SELECT \*
FROM products
WHERE barcode = '8410123456789';
Actualiza su precio:

UPDATE products
SET price = 1.09
WHERE barcode = '8410123456789';
Comprueba el cambio:

SELECT barcode, name, price
FROM products
WHERE barcode = '8410123456789'; 9. Salir de PostgreSQL
Ejecuta:

\q
Volverás a la terminal normal.

10. Ejecutar una consulta sin entrar en el terminal interactivo
    También puedes ejecutar una consulta puntual desde macOS:

heroku pg:psql -a shopp-db-test \
 -c "SELECT id, barcode, name, price, store FROM products ORDER BY id;"
Esto resulta útil para verificar rápidamente que la base de datos sigue accesible.

11. Comprobar la variable de conexión
    Puedes verificar que Heroku ha creado la variable:

heroku config -a shopp-db-test
Verás una línea similar a:

DATABASE_URL: postgres://...
No compartas el contenido completo de DATABASE_URL: incluye las credenciales de acceso. Heroku administra esta variable y puede cambiarla automáticamente cuando rota las credenciales. Por ese motivo, el servidor debe leer siempre process.env.DATABASE_URL; no debes copiar la URL directamente dentro de server.js.

12. Crear una tabla preparada para probar sockets
    Para la futura prueba de Socket.IO puedes añadir una segunda tabla. Vuelve a entrar:

heroku pg:psql -a shopp-db-test
Crea la tabla:

CREATE TABLE chat_messages (
id BIGSERIAL PRIMARY KEY,
room_id VARCHAR(100) NOT NULL,
user_id VARCHAR(100) NOT NULL,
text VARCHAR(1000) NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
Inserta un mensaje:

INSERT INTO chat_messages (room_id, user_id, text)
VALUES ('general', 'usuario-prueba', 'Primer mensaje almacenado en Heroku');
Compruébalo:

SELECT id, room_id, user_id, text, created_at
FROM chat_messages
ORDER BY created_at;
Sal:

\q
Resultado esperado
Al terminar tendrás una base de datos remota funcional con dos tablas:

products
chat_messages
La primera servirá para ensayar los datos de Shopp. La segunda permitirá verificar que el servidor Socket.IO guarda mensajes y los recupera correctamente.

El siguiente paso natural es crear un servidor Node.js mínimo con dos endpoints:

GET /health
GET /products
y un evento Socket.IO:

message:send
Así podrás comprobar desde el navegador que Heroku, PostgreSQL y los sockets funcionan conjuntamente.

Puedes ayudarme a persistir los datos de las listas, productos, tiendas,... en heroku

Voy a plantearlo como una migración gradual: mantener el funcionamiento offline de Shopp y añadir PostgreSQL en Heroku como fuente central de sincronización. Primero fijaré el modelo de datos y después el servidor REST mínimo.

Para una primera integración no conviene convertir inmediatamente cada pantalla y cada objeto en tablas distintas. La vía más robusta para avanzar sin romper Shopp es guardar un “snapshot” JSON versionado en PostgreSQL y normalizar después los datos compartidos, como precios y productos.

Pensó durante 45s
Sí. Como Shopp ya funciona con datos locales, la forma más segura de comenzar es añadir persistencia remota sin eliminar AsyncStorage.

No conectes la aplicación Expo directamente a PostgreSQL. Eso expondría las credenciales de la base de datos dentro del frontend. La aplicación debe comunicarse mediante HTTPS con un pequeño servidor Node.js alojado en Heroku:

Shopp: Expo / Netlify
│
│ HTTPS REST
▼
Servidor Node.js en Heroku
│
│ DATABASE_URL
▼
Heroku Postgres
Heroku asigna automáticamente la variable DATABASE_URL cuando una aplicación tiene una única base de datos PostgreSQL. Las variables de configuración quedan disponibles en Node.js como variables de entorno. Además, Heroku Postgres exige conexiones SSL.

Estrategia recomendada para Shopp
Conviene hacerlo en dos fases.

Fase 1: guardar una copia completa de los datos
Durante la primera prueba almacenaremos un documento JSON con el estado completo de Shopp:

{
lists: [],
archivedLists: [],
products: [],
stores: [],
scannerHistory: [],
settings: {}
}
PostgreSQL dispone del tipo JSONB, adecuado para persistir este documento. La aplicación seguirá funcionando offline con AsyncStorage. Cuando tenga conexión podrá subir o descargar una copia.

Esto permite validar rápidamente:

Heroku Postgres.

El servidor Node.js.

La comunicación desde Expo y Netlify.

La persistencia de listas, productos y tiendas.

La actualización entre dos dispositivos.

Fase 2: normalizar los datos compartidos
Más adelante separaremos tablas como:

products
stores
shopping_lists
shopping_list_items
purchases
purchase_items
product_prices
users
Esto será necesario cuando quieras comparar precios entre supermercados o compartir información entre usuarios. No es necesario para la primera prueba.

1. Crear el servidor
   Crea una carpeta independiente del proyecto Expo:

mkdir shopp-api
cd shopp-api

npm init -y
npm install express cors pg socket.io dotenv
npm pkg set scripts.start="node server.js"
npm pkg set engines.node="22.x"
Crea el archivo .gitignore:

node_modules
.env
.DS_Store
Crea un archivo llamado exactamente Procfile, sin extensión:

web: node server.js
El proceso web es el único tipo de proceso que recibe tráfico HTTP externo desde los routers de Heroku. La aplicación también debe escuchar el puerto proporcionado mediante $PORT.

2. Crear la tabla PostgreSQL
   Crea el archivo schema.sql:

CREATE TABLE IF NOT EXISTS app_snapshots (
owner_key VARCHAR(100) PRIMARY KEY,
payload JSONB NOT NULL DEFAULT '{}'::jsonb,
version BIGINT NOT NULL DEFAULT 1,
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
owner_key identificará inicialmente tu instalación personal de Shopp. En una aplicación con varios usuarios se sustituirá por el identificador del usuario autenticado.

El campo version evita sobrescribir silenciosamente cambios realizados desde otro dispositivo.

3. Crear el servidor REST y Socket.IO
   Crea server.js:

require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT || 3000);

const APP_TOKEN = String(process.env.APP_TOKEN || "").trim();
const OWNER_KEY = String(process.env.OWNER_KEY || "shopp-personal").trim();

const allowedOrigins = String(
process.env.CLIENT_ORIGIN || "http://localhost:8081,http://localhost:19006",
)
.split(",")
.map((value) => value.trim())
.filter(Boolean);

if (!APP_TOKEN) {
throw new Error("Falta la variable APP_TOKEN");
}

if (!process.env.DATABASE_URL) {
throw new Error("Falta la variable DATABASE_URL");
}

/\*\*

- node-postgres recomienda reutilizar un único Pool.
- Para una primera prueba es suficiente un máximo reducido de conexiones.
  \*/
  const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
  process.env.NODE_ENV === "production"
  ? {
  rejectUnauthorized: false,
  }
  : false,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  });

const app = express();
const httpServer = http.createServer(app);

app.use(
cors({
origin(origin, callback) {
/\*\*
_ Permite peticiones sin Origin, por ejemplo curl o aplicaciones móviles.
_/
if (!origin || allowedOrigins.includes(origin)) {
callback(null, true);
return;
}

      callback(new Error(`Origen no permitido: ${origin}`));
    },

}),
);

app.use(
express.json({
limit: "5mb",
}),
);

const io = new Server(httpServer, {
cors: {
origin: allowedOrigins,
methods: ["GET", "PUT"],
},
});

function readBearerToken(req) {
const authorization = String(req.headers.authorization || "");

if (!authorization.startsWith("Bearer ")) {
return "";
}

return authorization.slice("Bearer ".length).trim();
}

function requireToken(req, res, next) {
const token = readBearerToken(req);

if (token !== APP_TOKEN) {
res.status(401).json({
ok: false,
error: "No autorizado",
});

    return;

}

next();
}

function validateSnapshotPayload(data) {
if (!data || typeof data !== "object" || Array.isArray(data)) {
throw new Error("El snapshot debe ser un objeto JSON");
}

return {
lists: Array.isArray(data.lists) ? data.lists : [],
archivedLists: Array.isArray(data.archivedLists)
? data.archivedLists
: [],
products: Array.isArray(data.products) ? data.products : [],
stores: Array.isArray(data.stores) ? data.stores : [],
scannerHistory: Array.isArray(data.scannerHistory)
? data.scannerHistory
: [],
settings:
data.settings && typeof data.settings === "object"
? data.settings
: {},
};
}

async function initializeDatabase() {
await pool.query(`     CREATE TABLE IF NOT EXISTS app_snapshots (
      owner_key VARCHAR(100) PRIMARY KEY,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      version BIGINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

console.log("Base de datos inicializada");
}

app.get("/", (req, res) => {
res.json({
ok: true,
service: "shopp-api",
});
});

app.get("/health", async (req, res) => {
try {
const result = await pool.query("SELECT NOW() AS server_time");

    res.json({
      ok: true,
      database: "connected",
      serverTime: result.rows[0].server_time,
    });

} catch (error) {
console.error("Error comprobando PostgreSQL:", error);

    res.status(500).json({
      ok: false,
      database: "disconnected",
    });

}
});

/\*\*

- Descarga el snapshot remoto.
  \*/
  app.get("/api/snapshot", requireToken, async (req, res) => {
  try {
  const result = await pool.query(
  `         SELECT payload, version, updated_at
        FROM app_snapshots
        WHERE owner_key = $1
      `,
  [OWNER_KEY],
  );

      if (result.rowCount === 0) {
        res.json({
          ok: true,
          exists: false,
          version: 0,
          updatedAt: null,
          data: {
            lists: [],
            archivedLists: [],
            products: [],
            stores: [],
            scannerHistory: [],
            settings: {},
          },
        });

        return;
      }

      const row = result.rows[0];

      res.json({
        ok: true,
        exists: true,
        version: Number(row.version),
        updatedAt: row.updated_at,
        data: row.payload,
      });

  } catch (error) {
  console.error("Error leyendo snapshot:", error);

      res.status(500).json({
        ok: false,
        error: "No se pudo leer el snapshot",
      });

  }
  });

/\*\*

- Sube el snapshot.
-
- expectedVersion:
- 0 => todavía no existe una copia remota.
- N => el cliente ha descargado previamente la versión N.
  \*/
  app.put("/api/snapshot", requireToken, async (req, res) => {
  const client = await pool.connect();

try {
const data = validateSnapshotPayload(req.body?.data);
const expectedVersion = Number(req.body?.expectedVersion);

    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      res.status(400).json({
        ok: false,
        error: "expectedVersion no válido",
      });

      return;
    }

    await client.query("BEGIN");

    const currentResult = await client.query(
      `
        SELECT version
        FROM app_snapshots
        WHERE owner_key = $1
        FOR UPDATE
      `,
      [OWNER_KEY],
    );

    let savedResult;

    if (currentResult.rowCount === 0) {
      if (expectedVersion !== 0) {
        await client.query("ROLLBACK");

        res.status(409).json({
          ok: false,
          error: "Conflicto de versión",
          currentVersion: 0,
        });

        return;
      }

      savedResult = await client.query(
        `
          INSERT INTO app_snapshots (
            owner_key,
            payload,
            version,
            updated_at
          )
          VALUES ($1, $2::jsonb, 1, NOW())
          RETURNING version, updated_at
        `,
        [OWNER_KEY, JSON.stringify(data)],
      );
    } else {
      const currentVersion = Number(currentResult.rows[0].version);

      if (currentVersion !== expectedVersion) {
        await client.query("ROLLBACK");

        res.status(409).json({
          ok: false,
          error: "Existe una versión remota más reciente",
          currentVersion,
        });

        return;
      }

      savedResult = await client.query(
        `
          UPDATE app_snapshots
          SET
            payload = $2::jsonb,
            version = version + 1,
            updated_at = NOW()
          WHERE owner_key = $1
          RETURNING version, updated_at
        `,
        [OWNER_KEY, JSON.stringify(data)],
      );
    }

    await client.query("COMMIT");

    const saved = savedResult.rows[0];

    const response = {
      ok: true,
      version: Number(saved.version),
      updatedAt: saved.updated_at,
    };

    /**
     * Socket.IO no transporta el snapshot completo.
     * Solamente notifica que existe una versión nueva.
     */
    io.emit("snapshot:updated", response);

    res.json(response);

} catch (error) {
await client.query("ROLLBACK");

    console.error("Error guardando snapshot:", error);

    res.status(500).json({
      ok: false,
      error: error.message || "No se pudo guardar el snapshot",
    });

} finally {
client.release();
}
});

io.use((socket, next) => {
const token = String(socket.handshake.auth?.token || "");

if (token !== APP_TOKEN) {
next(new Error("No autorizado"));
return;
}

next();
});

io.on("connection", (socket) => {
console.log("Socket conectado:", socket.id);

socket.on("disconnect", (reason) => {
console.log("Socket desconectado:", socket.id, reason);
});
});

async function startServer() {
await initializeDatabase();

httpServer.listen(PORT, () => {
console.log(`Servidor iniciado en el puerto ${PORT}`);
});
}

async function shutdown() {
console.log("Cerrando servidor");

httpServer.close(async () => {
await pool.end();
process.exit(0);
});
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startServer().catch((error) => {
console.error("No se pudo iniciar el servidor:", error);
process.exit(1);
});
El servidor utiliza un único Pool de node-postgres. La documentación oficial recomienda reutilizar un número limitado de pools, normalmente uno por aplicación, en lugar de crear conexiones indiscriminadamente.

4. Asociar el servidor a tu aplicación Heroku
   Puedes reutilizar la aplicación que creaste para probar la base de datos.

Sustituye <APP_HEROKU> por el nombre real:

git init
git add .
git commit -m "Create Shopp persistence API"

heroku git:remote -a <APP_HEROKU>
Crea un token aleatorio:

openssl rand -hex 32
Copia el resultado y configúralo:

heroku config:set \
 APP_TOKEN="<TOKEN_GENERADO>" \
 OWNER_KEY="shopp-personal" \
 CLIENT_ORIGIN="https://tu-app.netlify.app,http://localhost:8081,http://localhost:19006" \
 NODE_ENV="production" \
 -a <APP_HEROKU>
No modifiques manualmente DATABASE_URL. Heroku administra esa variable y puede actualizarla cuando cambia la conexión principal.

Despliega el servidor:

git push heroku main
Consulta los logs:

heroku logs --tail -a <APP_HEROKU>
Deberías ver:

Base de datos inicializada
Servidor iniciado en el puerto ...
Heroku recomienda guardar en Git el archivo package-lock.json generado por npm install, porque un lockfile incoherente puede provocar fallos de construcción.

5. Probar la persistencia desde Terminal
   Obtén el dominio:

heroku info -a <APP_HEROKU>
Supongamos que el dominio es:

https://shopp-api-jn.herokuapp.com
Define variables locales:

export SHOPP_API_URL="https://shopp-api-jn.herokuapp.com"
export SHOPP_TOKEN="<TOKEN_GENERADO>"
Comprueba PostgreSQL:

curl "$SHOPP_API_URL/health"
Resultado esperado:

{
"ok": true,
"database": "connected",
"serverTime": "2026-06-13T..."
}
Sube un snapshot de prueba:

curl -X PUT "$SHOPP_API_URL/api/snapshot" \
 -H "Authorization: Bearer $SHOPP_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
"expectedVersion": 0,
"data": {
"lists": [
{
"id": "lista-1",
"name": "Compra semanal",
"dateISO": "2026-06-13",
"store": "Mercadona",
"items": [
{
"id": "item-1",
"name": "Leche",
"barcode": "8410123456789",
"qty": 2,
"unit": "ud",
"price": 1.15,
"category": "Lácteos",
"subcategory": "Leche",
"include": true,
"checked": false
}
]
}
],
"archivedLists": [],
"products": [],
"stores": [
{
"id": "store-1",
"name": "Mercadona"
}
],
"scannerHistory": [],
"settings": {
"currency": "EUR"
}
}
}'
Resultado esperado:

{
"ok": true,
"version": 1,
"updatedAt": "2026-06-13T..."
}
Descarga la copia:

curl "$SHOPP_API_URL/api/snapshot" \
 -H "Authorization: Bearer $SHOPP_TOKEN"
Comprueba también la tabla directamente:

heroku pg:psql -a <APP_HEROKU>
Dentro de PostgreSQL:

SELECT owner_key, version, updated_at
FROM app_snapshots;
Para ver el documento completo:

SELECT jsonb_pretty(payload)
FROM app_snapshots
WHERE owner_key = 'shopp-personal';
Sal con:

\q 6. Conectar Shopp con el servidor
En tu proyecto Expo instala Socket.IO si todavía no lo has hecho:

npm install socket.io-client
Crea:

services/cloudSnapshotService.js
Contenido:

const API_URL = "https://shopp-api-jn.herokuapp.com";
const APP_TOKEN = "<TOKEN_GENERADO>";

async function request(path, options = {}) {
const response = await fetch(`${API_URL}${path}`, {
...options,
headers: {
Authorization: `Bearer ${APP_TOKEN}`,
"Content-Type": "application/json",
...(options.headers || {}),
},
});

const payload = await response.json();

if (!response.ok) {
const error = new Error(payload?.error || "Error comunicando con Heroku");

    error.status = response.status;
    error.payload = payload;

    throw error;

}

return payload;
}

export async function downloadCloudSnapshot() {
return request("/api/snapshot");
}

export async function uploadCloudSnapshot(data, expectedVersion) {
return request("/api/snapshot", {
method: "PUT",
body: JSON.stringify({
data,
expectedVersion,
}),
});
}
Sustituye el dominio por el de tu aplicación real.

Este token sirve únicamente para una prueba personal. En una aplicación publicada no constituye autenticación suficiente porque cualquier valor incluido en Expo o JavaScript web puede inspeccionarse. Para una versión distribuida deberás utilizar usuarios autenticados y tokens temporales.

7. Leer los datos actuales desde AsyncStorage
   Crea:

services/localSnapshotService.js
Contenido:

import AsyncStorage from "@react-native-async-storage/async-storage";

/\*\*

- Ajusta estos nombres a las claves utilizadas realmente por Shopp.
  \*/
  const STORAGE_KEYS = {
  lists: "shopping_lists",
  archivedLists: "archived_lists",
  products: "products",
  stores: "stores",
  scannerHistory: "scanned_history",
  settings: "settings",
  };

function safeParse(value, fallback) {
if (!value) {
return fallback;
}

try {
return JSON.parse(value);
} catch (error) {
console.warn("No se pudo interpretar un valor local:", error);
return fallback;
}
}

export async function buildLocalSnapshot() {
const entries = await AsyncStorage.multiGet(
Object.values(STORAGE_KEYS),
);

const values = Object.fromEntries(entries);

return {
lists: safeParse(values[STORAGE_KEYS.lists], []),
archivedLists: safeParse(
values[STORAGE_KEYS.archivedLists],
[],
),
products: safeParse(values[STORAGE_KEYS.products], []),
stores: safeParse(values[STORAGE_KEYS.stores], []),
scannerHistory: safeParse(
values[STORAGE_KEYS.scannerHistory],
[],
),
settings: safeParse(values[STORAGE_KEYS.settings], {}),
};
}

export async function applyLocalSnapshot(snapshot) {
await AsyncStorage.multiSet([
[STORAGE_KEYS.lists, JSON.stringify(snapshot.lists || [])],
[
STORAGE_KEYS.archivedLists,
JSON.stringify(snapshot.archivedLists || []),
],
[
STORAGE_KEYS.products,
JSON.stringify(snapshot.products || []),
],
[STORAGE_KEYS.stores, JSON.stringify(snapshot.stores || [])],
[
STORAGE_KEYS.scannerHistory,
JSON.stringify(snapshot.scannerHistory || []),
],
[
STORAGE_KEYS.settings,
JSON.stringify(snapshot.settings || {}),
],
]);
}
Debes comprobar los nombres reales de las claves de AsyncStorage utilizadas por tu proyecto. En versiones anteriores de Shopp aparecen claves como:

shopping_lists
lists
scanned_history
No conviene crear claves duplicadas. Utiliza las que ya consume cada pantalla.

8. Añadir dos operaciones de sincronización
   Crea:

services/shoppSyncService.js
Contenido:

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
downloadCloudSnapshot,
uploadCloudSnapshot,
} from "./cloudSnapshotService";

import {
applyLocalSnapshot,
buildLocalSnapshot,
} from "./localSnapshotService";

const CLOUD_VERSION_KEY = "shopp_cloud_snapshot_version";

async function readLocalVersion() {
const value = await AsyncStorage.getItem(CLOUD_VERSION_KEY);

return Number(value || 0);
}

async function saveLocalVersion(version) {
await AsyncStorage.setItem(
CLOUD_VERSION_KEY,
String(version),
);
}

/\*\*

- Envía a Heroku el estado actual de AsyncStorage.
  \*/
  export async function uploadShoppData() {
  const snapshot = await buildLocalSnapshot();
  const expectedVersion = await readLocalVersion();

const response = await uploadCloudSnapshot(
snapshot,
expectedVersion,
);

await saveLocalVersion(response.version);

return response;
}

/\*\*

- Sustituye los datos locales por el snapshot remoto.
  \*/
  export async function downloadShoppData() {
  const response = await downloadCloudSnapshot();

if (!response.exists) {
return {
ok: true,
downloaded: false,
reason: "No existe copia remota",
};
}

await applyLocalSnapshot(response.data);
await saveLocalVersion(response.version);

return {
ok: true,
downloaded: true,
version: response.version,
updatedAt: response.updatedAt,
};
}
Ahora puedes vincular temporalmente estas operaciones a dos botones de una pantalla de ajustes:

import {
downloadShoppData,
uploadShoppData,
} from "../services/shoppSyncService";
Subir copia:

async function handleUploadBackup() {
try {
const result = await uploadShoppData();

    console.log("Copia subida:", result);

} catch (error) {
if (error.status === 409) {
console.warn(
"Existe una versión remota más reciente. Descárgala antes de sobrescribirla.",
);

      return;
    }

    console.error("Error subiendo copia:", error);

}
}
Descargar copia:

async function handleDownloadBackup() {
try {
const result = await downloadShoppData();

    console.log("Copia descargada:", result);

} catch (error) {
console.error("Error descargando copia:", error);
}
} 9. Qué conseguimos con esta primera implementación
Tendrás un sistema de copia y restauración remota:

AsyncStorage local
│
├── Subir copia ─────► Heroku Postgres
│
└── Descargar copia ◄─ Heroku Postgres
La aplicación seguirá funcionando sin cobertura. Los datos no dependerán del sistema de archivos del dyno: Heroku indica expresamente que las aplicaciones deben utilizar una base de datos o almacenamiento de objetos en lugar de escribir información persistente en el sistema de archivos local.

También quedará preparada una notificación Socket.IO:

snapshot:updated
Cuando un dispositivo suba cambios, los demás podrán saber que existe una versión más reciente y descargarla.

Limitación intencionada
Esta primera versión guarda un documento completo. Es adecuada para una copia personal y para validar la infraestructura. No resuelve todavía la combinación automática de ediciones concurrentes.

La siguiente mejora debería ser normalizar únicamente estas entidades:

stores
products
product_prices
shopping_lists
shopping_list_items
Así podrás sincronizar cambios parciales, compartir precios por código de barras y mantener listas independientes por usuario sin sustituir el estado completo.
