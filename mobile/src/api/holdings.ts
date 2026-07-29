import { apiClient } from "./client";
import { HoldingsSummary } from "./types";

export async function fetchHoldingsSummary() {
  const { data } = await apiClient.get<HoldingsSummary>(
    "/api/holdings/summary"
  );
  return data;
}

export async function saveHoldings(
  items: { assetKey: string; quantity: number }[]
) {
  const { data } = await apiClient.put<{ ok: true }>("/api/holdings", {
    items,
  });
  return data;
}
