import { apiClient } from "../../httpClient";

/**
 * REST adapter for the PostgreSQL shopping list API.
 * Pass the current access token from the app's session layer with each call.
 * This adapter is intentionally not selected by the app until auth/session
 * migration is completed.
 */
const request = (path, accessToken, options = {}) =>
  apiClient.request(path, { ...options, accessToken });

export const nodeShoppingListsApi = Object.freeze({
  async list(accessToken) {
    const result = await request("api/v1/shopping/lists", accessToken);
    return result.lists;
  },
  async exportData(accessToken) {
    return request("api/v1/shopping/user-data", accessToken);
  },
  importData(accessToken, data) {
    return request("api/v1/shopping/user-data", accessToken, { method: "POST", body: data });
  },
  async get(accessToken, listId) {
    const result = await request(`api/v1/shopping/lists/${encodeURIComponent(listId)}`, accessToken);
    return result.list;
  },
  async create(accessToken, list) {
    const result = await request("api/v1/shopping/lists", accessToken, { method: "POST", body: list });
    return result.list;
  },
  async update(accessToken, listId, patch) {
    const result = await request(`api/v1/shopping/lists/${encodeURIComponent(listId)}`, accessToken, { method: "PATCH", body: patch });
    return result.list;
  },
  remove(accessToken, listId) {
    return request(`api/v1/shopping/lists/${encodeURIComponent(listId)}`, accessToken, { method: "DELETE" });
  },
  async addItem(accessToken, listId, item) {
    const result = await request(`api/v1/shopping/lists/${encodeURIComponent(listId)}/items`, accessToken, { method: "POST", body: item });
    return result.item;
  },
  async updateItem(accessToken, listId, itemId, patch) {
    const result = await request(`api/v1/shopping/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`, accessToken, { method: "PATCH", body: patch });
    return result.item;
  },
  removeItem(accessToken, listId, itemId) {
    return request(`api/v1/shopping/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`, accessToken, { method: "DELETE" });
  },
});
