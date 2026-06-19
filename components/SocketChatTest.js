import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";

import { connectSocket } from "@/services/socketClient";

const ROOM_ID = "general";
const USER_ID = "usuario-prueba";

export default function SocketChatTest() {
  const [connected, setConnected] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const socket = connectSocket();

    if (!socket) {
      return undefined;
    }

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
      <Text>Estado: {connected ? "conectado" : "desconectado"}</Text>

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
}
