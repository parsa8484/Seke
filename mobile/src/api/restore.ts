import { apiClient } from "./client";

/**
 * بازیابیِ موقتِ دارایی‌های چند کاربر که مهاجرتِ ۲۰۲۶-۰۹-۲۴ به گوشی‌شان نرسید.
 * توضیح کامل و برنامه‌ی حذف: CLAUDE.md، بخش «بازیابی‌ی موقت».
 */
export interface RestoreItem {
  assetKey: string;
  quantity: number;
  avgBuyPrice: number | null;
}

// timeout کوتاه‌تر از پیش‌فرض: این درخواست جلوی بالا آمدن داشبورد ایستاده و
// نباید یک سرور کند آن را ۱۵ ثانیه نگه دارد
const RESTORE_TIMEOUT = 5000;

export async function fetchRestoreHoldings(): Promise<RestoreItem[]> {
  const { data } = await apiClient.get<{ items?: RestoreItem[] }>(
    "/api/restore/holdings",
    { timeout: RESTORE_TIMEOUT }
  );
  return data.items ?? [];
}

/** بعد از اینکه دارایی‌ها روی گوشی نشست و دوباره خوانده شد */
export async function ackRestoreHoldings(keys: string[]): Promise<void> {
  await apiClient.post(
    "/api/restore/holdings/ack",
    { keys },
    { timeout: RESTORE_TIMEOUT }
  );
}
