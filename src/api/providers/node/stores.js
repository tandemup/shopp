import { apiClient } from "../../httpClient";

const request = (path, accessToken, options = {}) =>
  apiClient.request(path, { ...options, accessToken });

export const nodeStoresApi = Object.freeze({
  async list(accessToken) {
    const result = await request("api/v1/stores", accessToken);
    return result.stores;
  },
  async listByCity(accessToken, city) {
    const result = await request(`api/v1/stores/city/${encodeURIComponent(city)}`, accessToken);
    return result.stores;
  },
  async getById(accessToken, id) {
    const result = await request(`api/v1/stores/${encodeURIComponent(id)}`, accessToken);
    return result.store;
  },
  async listFavorites(accessToken) {
    const result = await request("api/v1/stores/favorites", accessToken);
    return result.stores;
  },
  async exportCatalog(accessToken) {
    const result = await request("api/v1/stores/catalog/export", accessToken);
    return result.stores;
  },
  setFavorite(accessToken, id, favorite) {
    return request(`api/v1/stores/${encodeURIComponent(id)}/favorite`, accessToken, { method: "PUT", body: { favorite } });
  },
  importCatalog(accessToken, stores, mode = "merge") {
    return request("api/v1/stores/catalog/import", accessToken, { method: "POST", body: { stores, mode } });
  },
  deleteStore(accessToken, id) {
    return request(`api/v1/stores/${encodeURIComponent(id)}`, accessToken, { method: "DELETE" });
  },
  submitRequest(accessToken, payload) {
    return request("api/v1/stores/requests", accessToken, { method: "POST", body: payload });
  },
  async listPendingRequests(accessToken) {
    const result = await request("api/v1/stores/requests/pending", accessToken);
    return result.requests;
  },
  approveRequest(accessToken, requestId, coordinates) {
    return request(`api/v1/stores/requests/${encodeURIComponent(requestId)}/approve`, accessToken, { method: "POST", body: coordinates });
  },
  rejectRequest(accessToken, requestId, reason) {
    return request(`api/v1/stores/requests/${encodeURIComponent(requestId)}/reject`, accessToken, { method: "POST", body: { reason } });
  },
});
