import React from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import chatSocket from "../../services/chatSocket";

export default function ChatScreen() {
  const [connected, setConnected] = React.useState(false);
  const [text, setText] = React.useState("");
  const [messages, setMessages] = React.useState([]);

  React.useEffect(() => {
    chatSocket.connect();

    chatSocket.on("connect", () => {
      setConnected(true);
    });

    chatSocket.on("disconnect", () => {
      setConnected(false);
    });

    chatSocket.on("chat:system", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    chatSocket.on("chat:message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      chatSocket.off("connect");
      chatSocket.off("disconnect");
      chatSocket.off("chat:system");
      chatSocket.off("chat:message");
      chatSocket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    const cleanText = text.trim();

    if (!cleanText) return;

    chatSocket.emit("chat:message", {
      text: cleanText,
      user: "Shopp user",
    });

    setText("");
  };

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
          style={{
            paddingHorizontal: 16,
            justifyContent: "center",
            borderRadius: 8,
            backgroundColor: "#6d28d9",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}
