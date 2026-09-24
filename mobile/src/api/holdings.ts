import { apiClient } from "./client";
import { HoldingsSummary } from "./types";

/**
 * بازمانده‌های «دارایی‌های سمت سرور».
 *
 * از نسخه‌ای که دارایی‌ها روی گوشی ذخیره می‌شوند، این دو تابع فقط برای
 * مهاجرتِ یک‌باره‌اند: خواندن داده‌ی قدیمی، و بعد خالی کردنش از روی سرور.
 *
 * بعد از اینکه نسخه‌ی سرور همه‌ی کاربرها خالی شد، این فایل و اندپوینت
 * `/api/holdings` هر دو حذف می‌شوند.
 */
export async function fetchServerHoldings() {
  const { data } = await apiClient.get<HoldingsSummary>(
    "/api/holdings/summary"
  );
  return data;
}

/**
 * پاک کردن نسخه‌ی سرورِ دارایی‌های کاربر، بعد از اینکه سالم روی گوشی نشست.
 *
 * عمداً از همان اندپوینت موجود استفاده می‌کند به‌جای یک `DELETE` جدید: تعداد
 * صفر و قیمت خرید null یعنی ردیف دیگر هیچ اطلاعاتی از دارایی کاربر ندارد، و
 * این‌طور هیچ تغییری در بک‌اند و هیچ دیپلویی روی VPS لازم نمی‌شود. خودِ
 * ردیف‌های خالی هم در فاز بعد با drop شدن جدول از بین می‌روند.
 */
export async function wipeServerHoldings(assetKeys: string[]) {
  if (assetKeys.length === 0) return;
  await apiClient.put("/api/holdings", {
    items: assetKeys.map((assetKey) => ({
      assetKey,
      quantity: 0,
      avgBuyPrice: null,
    })),
  });
}
