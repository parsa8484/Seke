import { apiClient } from "./client";
import { AssetHistory, CatalogAsset } from "./types";

/**
 * کاتالوگ دارایی‌ها + آخرین قیمت هرکدام.
 *
 * عمومی است و نیاز به لاگین ندارد؛ هیچ داده‌ی شخصی‌ای در آن نیست. تعداد و
 * قیمت خریدِ کاربر روی خود دستگاه ذخیره می‌شود و اصلاً به سرور نمی‌رود.
 */
export async function fetchAssets() {
  const { data } = await apiClient.get<{ assets: CatalogAsset[] }>(
    "/api/prices"
  );
  return data.assets;
}

/** تاریخچه‌ی روزانه‌ی یک دارایی برای نمودار روند (قیمت بازار، عمومی) */
export async function fetchAssetHistory(assetKey: string, days = 30) {
  const { data } = await apiClient.get<AssetHistory>(
    `/api/prices/${encodeURIComponent(assetKey)}/history`,
    { params: { days } }
  );
  return data;
}
