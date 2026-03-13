import { useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

import StoreRow from "@/src/components/stores/StoreRow";
import { useStores } from "@/src/context/StoresContext";

export default function StoreSelectScreen() {
  const { stores, setSelectedStore } = useStores();
  const router = useRouter();

  const handleSelect = (store) => {
    setSelectedStore(store);
    router.back();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StoreRow store={item} onPress={() => handleSelect(item)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    padding: 16,
  },
});
