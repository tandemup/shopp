import React from 'react';
import { Platform } from 'react-native';
import ChatScreen from '@/src/screens/chat/ChatScreen';
import DialogHost from '@/src/components/ui/alert/DialogHost';
import PlaybackProvider from '@/src/components/playback/PlaybackProvider';
import { NodeChatProvider } from '@/src/api/providers/node/useChatBackend';

export default function NodeChatScreen({ user, accessToken, onBack }) {
  return (
    <NodeChatProvider accessToken={accessToken}>
      <PlaybackProvider>
        <ChatScreen onBack={onBack} initialAlias={user?.alias} />
        {Platform.OS === 'web' ? <DialogHost /> : null}
      </PlaybackProvider>
    </NodeChatProvider>
  );
}
