import { apiClient } from "./client";
import {
  AssetHistory,
  HoldingInput,
  HoldingsSummary,
  PortfolioHistory,
} from "./types";

export async function fetchHoldingsSummary() {
  const { data } = await apiClient.get<HoldingsSummary>(
    "/api/holdings/summary"
  );
  return data;
}

export async function saveHoldings(items: HoldingInput[]) {
  const { data } = await apiClient.put<{ ok: true }>("/api/holdings", {
    items,
  });
  return data;
}

/** روند ارزش کل پرتفوی کاربر (پیش‌فرض ۳۰ روز) */
export async function fetchPortfolioHistory(days = 30) {
  const { data } = await apiClient.get<PortfolioHistory>(
    "/api/holdings/history",
    { params: { days } }
  );
  return data;
}

/** روند قیمت یک دارایی برای نمودار (پیش‌فرض ۳۰ روز) */
export async function fetchAssetHistory(assetKey: string, days = 30) {
  const { data } = await apiClient.get<AssetHistory>(
    `/api/prices/${encodeURIComponent(assetKey)}/history`,
    { params: { days } }
  );
  return data;
}
