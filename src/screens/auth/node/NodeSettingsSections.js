import React from "react";
import DialogHost from "@/src/components/ui/alert/DialogHost";
import { SettingsContent } from "@/src/screens/settings/MenuScreen";
import { nodeShoppingListsApi } from "@/src/api/providers/node/shoppingLists";
import { nodeMusicPlaylistsApi } from "@/src/api/providers/node/musicPlaylists";
import { nodeClassicalPlaylistsApi } from "@/src/api/providers/node/classicalPlaylists";
import * as localPlaylists from "@/src/storage/playlists/playlistRepository";
import { buildPurchaseHistoryFromArchivedLists } from "@/src/utils/buildPurchaseHistoryFromArchivedLists";

export default function NodeSettingsSections({ user, accessToken, openBarcodeSettings, openSearchEngines }) {
  const getData = () => nodeShoppingListsApi.exportData(accessToken);
  const node = {
    openBarcodeSettings,
    openSearchEngines,
    async getLists() {
      const { lists, scanHistory } = await getData();
      const activeLists = lists.filter((list) => !list.archived);
      const archivedLists = lists.filter((list) => list.archived);
      const purchaseHistory = buildPurchaseHistoryFromArchivedLists(archivedLists.map((list) => ({
        ...list,
        items: list.items.filter((item) => item.checked === true),
      })));
      return { activeLists, archivedLists, purchaseHistory, scanHistory };
    },
    importData(lists, scanHistory, mode) {
      return nodeShoppingListsApi.importData(accessToken, { lists, scanHistory, mode });
    },
    async getPlaylists(type) {
      const local = await localPlaylists.list(type);
      const api = type === "classical" ? nodeClassicalPlaylistsApi : nodeMusicPlaylistsApi;
      const remote = await api.list(accessToken);
      return [...new Map([...remote, ...local].map((playlist) => [playlist.id ?? playlist._id, playlist])).values()];
    },
  };
  return (
    <>
      <SettingsContent
        currentUser={{ ...user, _id: user.id, profile: { alias: user.alias, phone: user.phone } }}
        scanHistoryStorage={{ getScannedHistory: async () => (await getData()).scanHistory }}
        node={node}
      />
      <DialogHost />
    </>
  );
}
