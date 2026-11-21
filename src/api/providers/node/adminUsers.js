import { apiClient } from '../../httpClient';

const base = 'api/v1/admin/users';

export const nodeAdminUsersApi = Object.freeze({
  list(accessToken) {
    return apiClient.request(base, { accessToken });
  },
  setRole(accessToken, userId, role) {
    return apiClient.request(`${base}/${encodeURIComponent(userId)}/role`, { method: 'PATCH', accessToken, body: { role } });
  },
  setStatus(accessToken, userId, status) {
    return apiClient.request(`${base}/${encodeURIComponent(userId)}/status`, { method: 'PATCH', accessToken, body: { status } });
  },
  setPermissions(accessToken, userId, permissions) {
    return apiClient.request(`${base}/${encodeURIComponent(userId)}/permissions`, { method: 'PATCH', accessToken, body: { permissions } });
  },
});
