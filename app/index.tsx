import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function Home() {
  return (
    <View>
      <Text>Shopp Home</Text>
      <Link href="/products">Ver productos</Link>
    </View>
  );
}
