import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { connectSocket, getSocket } from "../../services/socketClient";

const ROOM_ID = "general";

function mergeMessages(current, incoming) {
  const byId = new Map();

  [...current, ...incoming].forEach((message) => {
    if (message?.id != null) {
      byId.set(String(message.id), message);
    }
  });

  return [...byId.values()].sort((a, b) => {
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });
}

export default function ChatScreen() {
  const scrollRef = useRef(null);
  const userIdRef = useRef(
    `shopp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [userName, setUserName] = useState("Josh");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  const statusText = useMemo(() => {
    if (connected) return "Conectado";
    if (connectionError) return "Error de conexión";
    return "Desconectado";
  }, [connected, connectionError]);

  useEffect(() => {
    const socket = connectSocket();

    if (!socket) {
      setConnectionError("Falta EXPO_PUBLIC_SOCKET_URL");
      return undefined;
    }

    function joinRoom() {
      socket.emit("room:join", { roomId: ROOM_ID }, (response) => {
        if (!response?.ok) {
          setConnectionError(response?.error || "No se pudo entrar en la sala");
        }
      });
    }

    function handleConnect() {
      console.log("Socket conectado:", socket.id);
      setConnected(true);
      setConnectionError("");
      joinRoom();
    }

    function handleDisconnect(reason) {
      console.log("Socket desconectado:", reason);
      setConnected(false);
    }

    function handleHistory(payload = {}) {
      if (payload.roomId !== ROOM_ID) return;
      setMessages((current) => mergeMessages(current, payload.messages || []));
    }

    function handleNewMessage(message) {
      if (message?.roomId !== ROOM_ID) return;
      setMessages((current) => mergeMessages(current, [message]));
    }

    function handleConnectError(error) {
      console.log("Socket error:", error?.message);
      setConnected(false);
      setConnectionError(error?.message || "No se pudo conectar");
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:history", handleHistory);
    socket.on("message:new", handleNewMessage);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:history", handleHistory);
      socket.off("message:new", handleNewMessage);
      socket.off("connect_error", handleConnectError);

      // Conservamos la conexión al navegar por Shopp. Socket.IO gestiona
      // la reconexión y la siguiente entrada al chat vuelve a pedir historial.
    };
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [messages]);

  function handleSend() {
    const cleanText = text.trim();
    const socket = getSocket();

    if (!cleanText || !socket?.connected) {
      return;
    }

    socket.emit(
      "message:send",
      {
        roomId: ROOM_ID,
        userId: userIdRef.current,
        userName: userName.trim() || "Anónimo",
        text: cleanText,
      },
      (response) => {
        if (!response?.ok) {
          setConnectionError(response?.error || "No se pudo enviar el mensaje");
          return;
        }

        setText("");
      },
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Chat Shopp</Text>

        <View
          style={[
            styles.statusBadge,
            connected ? styles.statusConnected : styles.statusDisconnected,
          ]}
        >
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>

      {connectionError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{connectionError}</Text>
        </View>
      ) : null}

      <View style={styles.userBox}>
        <Text style={styles.label}>Nombre</Text>

        <TextInput
          value={userName}
          onChangeText={setUserName}
          placeholder="Tu nombre"
          style={styles.nameInput}
          maxLength={100}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Todavía no hay mensajes.</Text>
          </View>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.userId === userIdRef.current;

            return (
              <View
                key={String(message.id)}
                style={[
                  styles.messageBubble,
                  isOwnMessage ? styles.ownMessage : styles.otherMessage,
                ]}
              >
                <Text style={styles.messageUser}>
                  {message.userName || "Anónimo"}
                </Text>

                <Text style={styles.messageText}>{message.text}</Text>

                {message.createdAt ? (
                  <Text style={styles.messageDate}>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje..."
          style={styles.messageInput}
          multiline
          maxLength={1000}
          onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
        />

        <Pressable
          onPress={handleSend}
          disabled={!connected || !text.trim()}
          style={({ pressed }) => [
            styles.sendButton,
            (!connected || !text.trim()) && styles.sendButtonDisabled,
            pressed && styles.sendButtonPressed,
          ]}
        >
          <Text style={styles.sendButtonText}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusConnected: {
    backgroundColor: "#dcfce7",
  },
  statusDisconnected: {
    backgroundColor: "#fee2e2",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  errorBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff1f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecdd3",
  },
  errorText: {
    color: "#be123c",
    fontSize: 13,
  },
  userBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 6,
  },
  nameInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyBox: {
    marginTop: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 15,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  ownMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#ede9fe",
    borderColor: "#c4b5fd",
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
  },
  messageUser: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7c3aed",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: "#111827",
    lineHeight: 22,
  },
  messageDate: {
    marginTop: 6,
    fontSize: 11,
    color: "#6b7280",
    textAlign: "right",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 8,
  },
  messageInput: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
  },
  sendButton: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonPressed: {
    opacity: 0.75,
  },
  sendButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
});
