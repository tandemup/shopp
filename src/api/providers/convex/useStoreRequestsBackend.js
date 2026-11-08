import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/** Adapter for user-submitted store creation requests and admin moderation. */
export function useStoreRequestsBackend({ listEnabled = false } = {}) {
  const requests = useQuery(
    api.stores.listPendingStoreRequests,
    listEnabled ? {} : "skip",
  );
  const submitMutation = useMutation(api.stores.submitStoreRequest);
  const approveMutation = useMutation(api.stores.approveStoreRequest);
  const rejectMutation = useMutation(api.stores.rejectStoreRequest);

  return {
    requests,
    submitStoreRequest: (payload) => submitMutation(payload),
    approveStoreRequest: (payload) => approveMutation(payload),
    rejectStoreRequest: (payload) => rejectMutation(payload),
  };
}
