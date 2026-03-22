import { useLists } from "@/src/context/ListsContext";
import { useLocalSearchParams, useRouter } from "expo-router";

export function useStoreSelection() {
  const router = useRouter();
  const { mode, selectForListId } = useLocalSearchParams<{
    mode?: string;
    selectForListId?: string;
  }>();

  const { assignStoreToList } = useLists();

  const isSelectMode = mode === "select" && !!selectForListId;

  const handleSelectStore = (storeId: string) => {
    if (isSelectMode && selectForListId) {
      assignStoreToList(selectForListId, storeId);
      router.back();
      return;
    }

    // fallback (browse mode)
    router.push({
      pathname: "/store/[id]",
      params: { id: storeId },
    });
  };

  return {
    isSelectMode,
    handleSelectStore,
  };
}
