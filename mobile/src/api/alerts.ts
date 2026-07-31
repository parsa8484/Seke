import { apiClient } from "./client";
import { AlertDirection, PriceAlert } from "./types";

export async function fetchAlerts() {
  const { data } = await apiClient.get<{ alerts: PriceAlert[] }>("/api/alerts");
  return data.alerts;
}

export async function createAlert(input: {
  assetKey: string;
  direction: AlertDirection;
  targetPrice: number;
}) {
  const { data } = await apiClient.post<{ alert: PriceAlert }>(
    "/api/alerts",
    input
  );
  return data.alert;
}

export async function updateAlert(
  id: string,
  input: { isActive?: boolean; targetPrice?: number; direction?: AlertDirection }
) {
  const { data } = await apiClient.put<{ alert: PriceAlert }>(
    `/api/alerts/${id}`,
    input
  );
  return data.alert;
}

export async function deleteAlert(id: string) {
  const { data } = await apiClient.delete<{ ok: true }>(`/api/alerts/${id}`);
  return data;
}

export async function registerPushToken(token: string, platform?: "android" | "ios") {
  const { data } = await apiClient.post<{ ok: true }>("/api/alerts/push-token", {
    token,
    platform,
  });
  return data;
}
