import React from 'react';
import { nodeClassicalPlaylistsApi } from '@/src/api/providers/node/classicalPlaylists';
import NodePlaylistCollectionScreen from './NodePlaylistCollectionScreen';

export default function NodeClassicalPlaylistsScreen({ accessToken, onBack }) {
  return <NodePlaylistCollectionScreen
    accessToken={accessToken}
    onBack={onBack}
    collection="classical"
    playlistsApi={nodeClassicalPlaylistsApi}
  />;
}
