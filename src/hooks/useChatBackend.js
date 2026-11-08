import {
  useChatMessagesBackend,
  useChatRoomSummariesBackend,
  useChatBasicActionsBackend,
  useChatMediaActionsBackend,
  useChatExtendedActionsBackend,
} from "@/src/api/providers/convex/useChatBackend";

// Contratos públicos de Shopp: las pantallas no conocen Convex.
export const useChatMessages = useChatMessagesBackend;
export const useChatRoomSummaries = useChatRoomSummariesBackend;
export const useChatBasicActions = useChatBasicActionsBackend;
export const useChatMediaActions = useChatMediaActionsBackend;
export const useChatExtendedActions = useChatExtendedActionsBackend;
