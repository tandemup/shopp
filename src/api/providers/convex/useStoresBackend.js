import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Convex adapter for the store catalog. This is the only place where
 * the store catalog contract depends on Convex identifiers or hooks.
 * Subscribe only for admins, preserving the existing access strategy.
 */
export function useStoresBackend({ enabled = false } = {}) {
  const stores = useQuery(
    api.stores.listStoresWithMyFavorites,
    enabled ? {} : "skip",
  );
  const toggleFavoriteMutation = useMutation(api.stores.toggleMyFavoriteStore);
  const importStoresMutation = useMutation(api.stores.upsertStores);

  return {
    stores,
    isLoading: enabled && stores === undefined,
    toggleFavorite: (storeId) => toggleFavoriteMutation({ id: storeId }),
    importStores: (storesToImport) => importStoresMutation({ stores: storesToImport }),
  };
}
