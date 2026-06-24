import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
} from "react-native";

import chatSocket from "@/services/chatSocket";
import { getChatMessages } from "@/services/chatApi";

const DEFAULT_CHAT_ROOM = "general";
const DEFAULT_CHAT_USERNAME = "Shopp user";

function normalizeMessage(message, fallbackRoom = DEFAULT_CHAT_ROOM) {
  return {
    id: String(message.id ?? `${Date.now()}-${Math.random()}`),
    room: message.room ?? fallbackRoom,
    username: message.username ?? message.userName ?? "anonymous",
    text: message.text ?? "",
    created_at:
      message.created_at ?? message.createdAt ?? new Date().toISOString(),
  };
}

export default function ChatScreen() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  const [roomInput, setRoomInput] = useState(DEFAULT_CHAT_ROOM);
  const [usernameInput, setUsernameInput] = useState(DEFAULT_CHAT_USERNAME);
  const [activeRoom, setActiveRoom] = useState(DEFAULT_CHAT_ROOM);
  const [activeUsername, setActiveUsername] = useState(DEFAULT_CHAT_USERNAME);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);

      const storedMessages = await getChatMessages(activeRoom);

      const normalizedMessages = storedMessages
        .map((message) => normalizeMessage(message, activeRoom))
        .filter((message) => message.room === activeRoom)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setMessages(normalizedMessages);
    } catch (error) {
      console.warn("No se pudieron cargar los mensajes:", error?.message);
    } finally {
      setLoading(false);
    }
  }, [activeRoom]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const socket = chatSocket.connectChatSocket();

    const joinActiveRoom = () => {
      socket.emit("chat:join", {
        room: activeRoom,
        username: activeUsername,
      });
    };

    const handleConnect = () => {
      setConnected(true);
      joinActiveRoom();
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleMessage = (message) => {
      const normalizedMessage = normalizeMessage(message, activeRoom);

      if (normalizedMessage.room !== activeRoom) {
        return;
      }

      setMessages((prev) => {
        const exists = prev.some((item) => item.id === normalizedMessage.id);

        if (exists) {
          return prev;
        }

        return [normalizedMessage, ...prev];
      });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:message", handleMessage);

    if (socket.connected) {
      setConnected(true);
      joinActiveRoom();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:message", handleMessage);
    };
  }, [activeRoom, activeUsername]);

  const joinRoom = useCallback(() => {
    const nextRoom = roomInput.trim() || DEFAULT_CHAT_ROOM;
    const nextUsername = usernameInput.trim() || DEFAULT_CHAT_USERNAME;

    setActiveRoom(nextRoom);
    setActiveUsername(nextUsername);
    setRoomInput(nextRoom);
    setUsernameInput(nextUsername);
    setMessages([]);
  }, [roomInput, usernameInput]);

  const sendMessage = useCallback(() => {
    const value = text.trim();

    if (!value) return;

    const socket = chatSocket.getChatSocket();

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("chat:message", {
      room: activeRoom,
      username: activeUsername,
      text: value,
    });

    setText("");
  }, [activeRoom, activeUsername, text]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat Shopp</Text>

      <Text style={styles.status}>
        Estado: {connected ? "conectado" : "desconectado"} · Sala: {activeRoom}{" "}
        · Usuario: {activeUsername}
      </Text>

      <View style={styles.settingsCard}>
        <TextInput
          value={roomInput}
          onChangeText={setRoomInput}
          placeholder="Sala, por ejemplo general"
          style={styles.settingsInput}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={joinRoom}
        />

        <TextInput
          value={usernameInput}
          onChangeText={setUsernameInput}
          placeholder="Nombre de usuario"
          style={styles.settingsInput}
          returnKeyType="done"
          onSubmitEditing={joinRoom}
        />

        <Pressable style={styles.secondaryButton} onPress={joinRoom}>
          <Text style={styles.secondaryButtonText}>Entrar</Text>
        </Pressable>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Cargando mensajes...</Text>
      ) : null}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.username === activeUsername ? styles.ownMessageBubble : null,
            ]}
          >
            <Text style={styles.messageUser}>{item.username}</Text>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageDate}>
              {new Date(item.created_at).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Escribe en ${activeRoom}...`}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />

        <Pressable style={styles.button} onPress={sendMessage}>
          <Text style={styles.buttonText}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  status: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
  },
  settingsCard: {
    gap: 8,
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    backgroundColor: "#fafafa",
  },
  settingsInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  loadingText: {
    fontSize: 13,
    color: "#777",
    marginBottom: 8,
  },
  messages: {
    paddingVertical: 12,
  },
  messageBubble: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    backgroundColor: "#f2f2f7",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  ownMessageBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#ede9fe",
  },
  messageUser: {
    fontWeight: "700",
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
  },
  messageDate: {
    fontSize: 11,
    color: "#777",
    marginTop: 4,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
