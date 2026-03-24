import { useLists } from "@/src/context/ListsContext";
import { useLocalSearchParams, useRouter } from "expo-router";

export function useStoreSelection() {
  const router = useRouter();
  const { mode, selectForListId } = useLocalSearchParams();
  const { assignStoreToList } = useLists();

  const isSelectMode = mode === "select";

  const handleSelectStore = (store) => {
    if (isSelectMode && selectForListId) {
      // 👉 en vez de seleccionar directamente → abrimos detail
      router.push({
        pathname: "/storefront/[id]/info",
        params: {
          id: store.id,
          mode: "select",
          selectForListId,
        },
      });
      return;
    }

    // 👉 modo normal → abrir detail
    router.push({
      pathname: "/storefront/[id]/info",
      params: { id: store.id },
    });
  };

  return {
    handleSelectStore,
    isSelectMode,
  };
}
