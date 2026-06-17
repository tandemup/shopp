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
import { socket } from "../../services/socketClient";

export default function ChatScreen() {
  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [userName, setUserName] = useState("Josh");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  const statusText = useMemo(() => {
    return connected ? "Conectado" : "Desconectado";
  }, [connected]);

  useEffect(() => {
    const handleConnect = () => {
      console.log("Socket conectado:", socket.id);
      setConnected(true);
    };

    const handleDisconnect = (reason) => {
      console.log("Socket desconectado:", reason);
      setConnected(false);
    };

    const handleMessage = (message) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleConnectError = (error) => {
      console.log("Socket error:", error?.message);
      setConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:message", handleMessage);
    socket.on("connect_error", handleConnectError);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:message", handleMessage);
      socket.off("connect_error", handleConnectError);

      socket.disconnect();
    };
  }, []);
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = () => {
    const cleanText = text.trim();

    if (!cleanText) return;

    const payload = {
      user: userName.trim() || "Anónimo",
      text: cleanText,
    };
    if (!socket.connected) {
      console.log("No se puede enviar: socket desconectado");
      return;
    }

    socket.emit("chat:message", payload);
    setText("");
  };

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

      <View style={styles.userBox}>
        <Text style={styles.label}>Nombre</Text>

        <TextInput
          value={userName}
          onChangeText={setUserName}
          placeholder="Tu nombre"
          style={styles.nameInput}
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
          messages.map((message, index) => (
            <View key={`${message.id || index}`} style={styles.messageBubble}>
              <Text style={styles.messageUser}>
                {message.user || "Anónimo"}
              </Text>

              <Text style={styles.messageText}>{message.text}</Text>

              {message.createdAt ? (
                <Text style={styles.messageDate}>
                  {new Date(message.createdAt).toLocaleTimeString()}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje..."
          style={styles.messageInput}
          multiline
        />

        <Pressable
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendButton,
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  messageUser: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563eb",
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
    color: "#9ca3af",
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
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
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
