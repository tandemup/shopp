export const isAdminUser = (user) =>
  user?.isAdmin === true || user?.role === "admin";

export const PUBLIC_FEATURES = Object.freeze({
  SHOPPING_LISTS: "shoppingLists",
  PLAYLISTS: "playlists",
  ACCOUNT: "account",
});

