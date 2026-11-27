import { isNodeBackend } from '@/src/api/config';
import * as convex from '@/src/api/providers/convex/useChatBackend';
import * as node from '@/src/api/providers/node/useChatBackend';

const provider = isNodeBackend ? node : convex;

export const useChatMessages = provider.useChatMessagesBackend;
export const useChatRoomSummaries = provider.useChatRoomSummariesBackend;
export const useChatBasicActions = provider.useChatBasicActionsBackend;
export const useChatMediaActions = provider.useChatMediaActionsBackend;
export const useChatExtendedActions = provider.useChatExtendedActionsBackend;
export const useChatReadError = isNodeBackend ? node.useChatReadErrorBackend : () => null;
