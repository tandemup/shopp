import { useLocalSearchParams } from "expo-router";
import { View, Text } from "react-native";

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Detalle de lista: {id}</Text>
    </View>
  );
}