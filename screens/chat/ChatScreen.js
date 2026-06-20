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

export default function ChatScreen() {
  const [connected, setConnected] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const socket = chatSocket.connectChatSocket();

    const handleConnect = () => {
      setConnected(true);

      socket.emit("chat:join", {
        room: "general",
      });
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleMessage = (message) => {
      setMessages((prev) => [message, ...prev]);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:message", handleMessage);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:message", handleMessage);
    };
  }, []);

  const sendMessage = useCallback(() => {
    const value = text.trim();

    if (!value) return;

    const socket = chatSocket.getChatSocket();

    socket.emit("chat:message", {
      room: "general",
      text: value,
      userName: "Shopp user",
    });

    setText("");
  }, [text]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat Shopp</Text>

      <Text style={styles.status}>
        Estado: {connected ? "conectado" : "desconectado"}
      </Text>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => (
          <View style={styles.messageBubble}>
            <Text style={styles.messageUser}>{item.userName}</Text>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageDate}>
              {new Date(item.createdAt).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje..."
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
