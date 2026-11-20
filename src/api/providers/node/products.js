import { apiClient } from "../../httpClient";

const barcodePath = (barcode) => encodeURIComponent(String(barcode || ""));
const request = (path, accessToken, options = {}) =>
  apiClient.request(path, { ...options, accessToken });

export const nodeProductsApi = Object.freeze({
  async search(accessToken, query, limit = 20) {
    const params = new URLSearchParams({ q: String(query || ""), limit: String(limit) });
    const result = await request(`api/v1/products/search?${params.toString()}`, accessToken);
    return Array.isArray(result.products) ? result.products : [];
  },
  async getByBarcode(accessToken, barcode) {
    const result = await request(`api/v1/products/${barcodePath(barcode)}`, accessToken);
    return result.product;
  },
  async registerAccess(accessToken, barcode) {
    return request(`api/v1/products/${barcodePath(barcode)}/access`, accessToken, { method: "POST" });
  },
  async saveProductData(accessToken, product) {
    const result = await request(`api/v1/products/${barcodePath(product?.barcode)}`, accessToken, { method: "PUT", body: product });
    return result.product;
  },
  async markAsNotFound(accessToken, barcode) {
    const result = await request(`api/v1/products/${barcodePath(barcode)}/not-found`, accessToken, { method: "POST" });
    return result.product;
  },
  deleteProductByBarcode(accessToken, barcode) {
    return request(`api/v1/products/${barcodePath(barcode)}`, accessToken, { method: "DELETE" });
  },
});
