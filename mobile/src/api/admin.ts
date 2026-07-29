import { apiClient } from "./client";
import {
  AdminStats,
  AdminUser,
  AdminUserDetail,
  AdminAsset,
  AdminAssetInput,
} from "./types";

export async function fetchAdminStats() {
  const { data } = await apiClient.get<AdminStats>("/api/admin/stats");
  return data;
}

export async function triggerPriceRefresh() {
  const { data } = await apiClient.post<{ ok: true; updated: number }>(
    "/api/admin/prices/refresh"
  );
  return data;
}

export async function fetchAdminUsers() {
  const { data } = await apiClient.get<{ users: AdminUser[] }>(
    "/api/admin/users"
  );
  return data.users;
}

export async function fetchAdminUserDetail(id: string) {
  const { data } = await apiClient.get<AdminUserDetail>(
    `/api/admin/users/${id}`
  );
  return data;
}

export async function updateAdminUser(
  id: string,
  patch: { role?: "user" | "admin"; isActive?: boolean }
) {
  const { data } = await apiClient.put<{ user: AdminUser }>(
    `/api/admin/users/${id}`,
    patch
  );
  return data.user;
}

export async function deleteAdminUser(id: string) {
  await apiClient.delete(`/api/admin/users/${id}`);
}

export async function fetchAdminAssets() {
  const { data } = await apiClient.get<{ assets: AdminAsset[] }>(
    "/api/admin/assets"
  );
  return data.assets;
}

export async function createAdminAsset(input: AdminAssetInput) {
  const { data } = await apiClient.post<{ asset: AdminAsset }>(
    "/api/admin/assets",
    input
  );
  return data.asset;
}

export async function updateAdminAsset(
  id: string,
  patch: Partial<AdminAssetInput> & { isActive?: boolean }
) {
  const { data } = await apiClient.put<{ asset: AdminAsset }>(
    `/api/admin/assets/${id}`,
    patch
  );
  return data.asset;
}

export async function deleteAdminAsset(id: string) {
  await apiClient.delete(`/api/admin/assets/${id}`);
}

export async function setAdminAssetPrice(id: string, price: number) {
  const { data } = await apiClient.put<{ asset: AdminAsset }>(
    `/api/admin/assets/${id}/price`,
    { price }
  );
  return data.asset;
}
