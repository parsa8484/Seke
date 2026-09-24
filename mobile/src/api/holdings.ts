import { apiClient } from "./client";
import { HoldingsSummary } from "./types";

/**
 * تنها بازمانده‌ی «دارایی‌های سمت سرور».
 *
 * از نسخه‌ای که دارایی‌ها روی گوشی ذخیره می‌شوند، این فقط برای مهاجرتِ یک‌باره
 * صدا زده می‌شود: اولین اجرای اپ بعد از به‌روزرسانی، تعدادهای قبلیِ کاربر را از
 * سرور می‌خواند و داخل حافظه‌ی دستگاه می‌نویسد (src/storage/holdings.ts).
 *
 * بعد از اینکه همه‌ی کاربرها به‌روزرسانی را گرفتند، این فایل و اندپوینت
 * `/api/holdings` هر دو حذف می‌شوند.
 */
export async function fetchServerHoldings() {
  const { data } = await apiClient.get<HoldingsSummary>(
    "/api/holdings/summary"
  );
  return data;
}
