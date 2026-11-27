import React from 'react';
import { nodeMusicPlaylistsApi } from '@/src/api/providers/node/musicPlaylists';
import NodePlaylistCollectionScreen from './NodePlaylistCollectionScreen';

export default function NodeMusicPlaylistsScreen({ accessToken, onBack }) {
  return <NodePlaylistCollectionScreen
    accessToken={accessToken}
    onBack={onBack}
    collection="playlist"
    playlistsApi={nodeMusicPlaylistsApi}
  />;
}
