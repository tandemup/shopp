import { apiClient } from "../../httpClient";

const request = (path, accessToken, options = {}) =>
  apiClient.request(path, { ...options, accessToken });

export const nodeStoreOffersApi = Object.freeze({
  async listApproved(limit = 100) {
    const result = await request(`api/v1/store-offers/approved?limit=${encodeURIComponent(limit)}`);
    return result.offers;
  },
  async create(accessToken, offer) {
    const result = await request("api/v1/store-offers", accessToken, { method: "POST", body: offer });
    return result.offer;
  },
  async listForAdmin(accessToken, status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const result = await request(`api/v1/store-offers${query}`, accessToken);
    return result.offers;
  },
  async updateStatus(accessToken, id, status) {
    const result = await request(`api/v1/store-offers/${encodeURIComponent(id)}/status`, accessToken, { method: "PATCH", body: { status } });
    return result.offer;
  },
});
