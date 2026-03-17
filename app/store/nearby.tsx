import { router, useLocalSearchParams } from "expo-router";
import { FlatList } from "react-native";

import StoreRow from "@/src/components/stores/StoreRow";
import { useLists } from "@/src/context/ListsContext";
import { useStores } from "@/src/context/StoresContext";

// distancia simple (mock)
function getDistance(store) {
  if (!store.lat || !store.lng) return 9999;
  return Math.random() * 5; // luego GPS real
}

export default function NearbyStoresScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();

  const { stores } = useStores();
  const { updateListStore } = useLists();

  const sorted = [...stores].sort((a, b) => getDistance(a) - getDistance(b));

  const selectStore = (storeId: string) => {
    if (!listId) return;

    updateListStore(listId, storeId);
    router.replace(`/list/${listId}`);
  };

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={sorted}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <StoreRow store={item} onPress={() => selectStore(item.id)} />
      )}
    />
  );
}
