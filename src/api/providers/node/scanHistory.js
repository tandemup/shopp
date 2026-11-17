import { apiClient } from "../../httpClient";

const barcodePath = (barcode) => encodeURIComponent(String(barcode || ""));
const request = (path, accessToken, options = {}) =>
  apiClient.request(path, { ...options, accessToken });

export const nodeScanHistoryApi = Object.freeze({
  async list(accessToken, limit = 100) {
    const result = await request(`api/v1/scans?limit=${encodeURIComponent(limit)}`, accessToken);
    return result.items;
  },
  async getByBarcode(accessToken, barcode) {
    const result = await request(`api/v1/scans/${barcodePath(barcode)}`, accessToken);
    return result.item;
  },
  async save(accessToken, item) {
    const result = await request("api/v1/scans", accessToken, { method: "POST", body: item });
    return result.item;
  },
  async sync(accessToken, item) {
    const result = await request(`api/v1/scans/${barcodePath(item?.barcode)}`, accessToken, { method: "PUT", body: item });
    return result.item;
  },
  remove(accessToken, barcode) {
    return request(`api/v1/scans/${barcodePath(barcode)}`, accessToken, { method: "DELETE" });
  },
  clear(accessToken) {
    return request("api/v1/scans", accessToken, { method: "DELETE" });
  },
});
