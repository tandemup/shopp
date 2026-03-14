import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function AddItem() {
  const { listId } = useLocalSearchParams();

  return (
    <View>
      <Text>Add item to list {listId}</Text>
    </View>
  );
}
