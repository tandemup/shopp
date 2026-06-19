import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import chatSocket from "@/services/chatSocket";

export default function ChatScreen() {
  const [connected, setConnected] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const handleConnect = () => {
      setConnected(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleConnectError = (error) => {
      setConnected(false);

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          user: "Sistema",
          text: `Error de conexión: ${error?.message || "desconocido"}`,
        },
      ]);
    };

    const handleSystemMessage = (message) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleChatMessage = (message) => {
      setMessages((prev) => [...prev, message]);
    };

    chatSocket.on("connect", handleConnect);
    chatSocket.on("disconnect", handleDisconnect);
    chatSocket.on("connect_error", handleConnectError);
    chatSocket.on("chat:system", handleSystemMessage);
    chatSocket.on("chat:message", handleChatMessage);

    chatSocket.connect();

    return () => {
      chatSocket.off("connect", handleConnect);
      chatSocket.off("disconnect", handleDisconnect);
      chatSocket.off("connect_error", handleConnectError);
      chatSocket.off("chat:system", handleSystemMessage);
      chatSocket.off("chat:message", handleChatMessage);
      chatSocket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    const cleanText = text.trim();

    if (!cleanText || !connected) return;

    chatSocket.emit("chat:message", {
      text: cleanText,
      user: "Shopp user",
    });

    setText("");
  };

  const canSend = connected && text.trim().length > 0;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Estado: {connected ? "Conectado" : "Desconectado"}</Text>

      <FlatList
        data={messages}
        keyExtractor={(item, index) => item.id || `${index}`}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 8 }}>
            <Text style={{ fontWeight: "700" }}>{item.user || "Sistema"}</Text>
            <Text>{item.text}</Text>
          </View>
        )}
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje"
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 8,
            padding: 10,
          }}
        />

        <Pressable
          onPress={sendMessage}
          disabled={!canSend}
          style={{
            paddingHorizontal: 16,
            justifyContent: "center",
            borderRadius: 8,
            backgroundColor: canSend ? "#6d28d9" : "#aaa",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}
