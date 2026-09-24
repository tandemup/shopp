export const isAdminUser = (user) =>
  user?.isAdmin === true || user?.role === "admin";

export const APP_FEATURES = Object.freeze({
  SCANNER: "scanner",
  STORES: "stores",
  CHAT: "chat",
  PARKING: "parking",
  ENGLISH_TUTOR: "englishTutor",
  LIBRARY: "library",
  MUSIC_PLAYLIST: "musicPlaylist",
  CLASSICAL_MUSIC: "classicalMusic",
  TUTORIALS: "tutorials",
  NEWS: "news",
  SHOPP_LIVE: "shoppLive",
  P2P_PLAYLIST_EXCHANGE: "p2pPlaylistExchange",
  FIRE_ALARM: "fireAlarm",
  INVESTMENTS: "investments",
});

export const hasFeatureAccess = (user, feature) =>
  isAdminUser(user) || user?.permissions?.[feature] === true;

export const PUBLIC_FEATURES = Object.freeze({
  SHOPPING_LISTS: "shoppingLists",
  PLAYLISTS: "playlists",
  ACCOUNT: "account",
});
