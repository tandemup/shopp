import { useLists } from "@/hooks/useLists";
import { addItemToList } from "@/services/list.service";
import { useLocalSearchParams } from "expo-router";
import { Button, Text, View } from "react-native";

export default function ListDetail() {
  const { id } = useLocalSearchParams();
  const lists = useLists();

  const list = lists.find((l) => l.id === id);

  if (!list) return null;

  return (
    <View>
      <Text>{list.name}</Text>

      <Button
        title="Añadir Pan"
        onPress={() => addItemToList(list.id, "Pan")}
      />

      {list.items.map((item) => (
        <Text key={item.id}>
          {item.name} ({item.quantity})
        </Text>
      ))}
    </View>
  );
}
