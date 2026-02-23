import { getDatabase } from "@/db";
import { useProducts } from "@/hooks/useProducts";
import { makeId } from "@/utils/id";
import { Button, Text, View } from "react-native";

export default function ProductsScreen() {
  const products = useProducts();

  const addProduct = async () => {
    const db = await getDatabase();

    await db.products.insert({
      id: makeId(),
      name: "Leche Entera",
      barcode: "8412345678901",
      lastPrice: 1.45,
      updatedAt: Date.now(),
    });
  };

  return (
    <View>
      <Button title="Añadir producto" onPress={addProduct} />

      {products.map((p) => (
        <Text key={p.id}>
          {p.name} - {p.lastPrice}€
        </Text>
      ))}
    </View>
  );
}
