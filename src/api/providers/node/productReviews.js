import { apiClient } from "../../httpClient";

const request = (path, accessToken, options = {}) =>
  apiClient.request(path, { ...options, accessToken });

export const nodeProductReviewsApi = Object.freeze({
  async submit(accessToken, submission) {
    const result = await request("api/v1/product-reviews", accessToken, { method: "POST", body: submission });
    return result.submission;
  },
  async listForAdmin(accessToken, { status = "pending_review", limit = 100 } = {}) {
    const query = new URLSearchParams({ status, limit: String(limit) }).toString();
    const result = await request(`api/v1/product-reviews?${query}`, accessToken);
    return result.submissions;
  },
  async updateForAdmin(accessToken, id, patch) {
    const result = await request(`api/v1/product-reviews/${encodeURIComponent(id)}`, accessToken, { method: "PATCH", body: patch });
    return result.submission;
  },
  async approveForAdmin(accessToken, id, reviewNote) {
    const result = await request(`api/v1/product-reviews/${encodeURIComponent(id)}/approve`, accessToken, { method: "POST", body: { reviewNote } });
    return result.submission;
  },
  async rejectForAdmin(accessToken, id, reviewNote) {
    const result = await request(`api/v1/product-reviews/${encodeURIComponent(id)}/reject`, accessToken, { method: "POST", body: { reviewNote } });
    return result.submission;
  },
});
