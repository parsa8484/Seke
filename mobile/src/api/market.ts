import { apiClient } from "./client";
import { MarketHistory, MarketResponse } from "./types";

/** لیست کامل قیمت‌های بازار از tgju — تب «قیمت‌ها» */
export async function fetchMarket() {
  const { data } = await apiClient.get<MarketResponse>("/api/market");
  return data;
}

/** تاریخچه‌ی روزانه‌ی یک نماد بازار (برای نمودار روند) */
export async function fetchMarketHistory(symbol: string, days = 30) {
  const { data } = await apiClient.get<MarketHistory>(
    `/api/market/history/${encodeURIComponent(symbol)}`,
    { params: { days } }
  );
  return data;
}
