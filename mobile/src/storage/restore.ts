import { ackRestoreHoldings, fetchRestoreHoldings } from "../api/restore";
import {
  LocalHoldings,
  readLocalHoldingsStrict,
  sanitize,
  writeLocalHoldings,
} from "./holdings";

/**
 * بازیابیِ موقتِ دارایی‌هایی که موقع مهاجرتِ ۲۰۲۶-۰۹-۲۴ به گوشی نرسیدند
 * (کاربری که اپ را بین به‌روزرسانی‌ها باز نکرد). سرور نسخه‌ی آن‌ها را در یک
 * فایل موقت نگه می‌دارد؛ اینجا یک‌بار گرفته می‌شود، روی گوشی می‌نشیند، دوباره
 * از دیسک خوانده می‌شود، و فقط بعد از آن به سرور گفته می‌شود نسخه‌اش را پاک کند.
 *
 * برای هر کسی که چیزی ندارد یک GET خالی است و تمام. کل این فایل، api/restore.ts
 * و فراخوانی‌اش در useHoldings بعد از اینکه همه گرفتند حذف می‌شوند — CLAUDE.md،
 * بخش «بازیابی‌ی موقت».
 *
 * هیچ‌وقت پرتاب نمی‌کند: بازیابی ناموفق نباید جلوی بالا آمدن داشبورد را بگیرد.
 * همه‌ی مرحله‌ها idempotent‌اند، پس ناموفق بودن یعنی «دفعه‌ی بعد دوباره».
 */
export async function restoreHoldingsFromServer(userId: string): Promise<void> {
  try {
    const items = await fetchRestoreHoldings();
    if (items.length === 0) return;

    const fromServer: LocalHoldings = {};
    for (const item of items) {
      const clean = sanitize({
        quantity: item.quantity,
        avgBuyPrice: item.avgBuyPrice,
      });
      if (clean) fromServer[item.assetKey] = clean;
    }

    // خواندنِ سخت‌گیر: خطای دیسک را «خالی» نگیر، وگرنه پایین‌تر داده‌ی خودِ
    // کاربر را با نسخه‌ی سرور بازنویسی می‌کنیم.
    const current = await readLocalHoldingsStrict(userId);

    // چیزی که کاربر خودش روی گوشی دارد بر نسخه‌ی سرور مقدم است
    const merged: LocalHoldings = { ...fromServer, ...current };

    if (Object.keys(merged).length > 0) {
      if (!(await writeLocalHoldings(userId, merged))) return;
      // تنها ضمانتی که قبل از پاک شدنِ نسخه‌ی سرور داریم: دوباره از دیسک بخوان
      const stored = await readLocalHoldingsStrict(userId);
      const intact = Object.entries(merged).every(([key, value]) => {
        const got = stored[key];
        return (
          got !== undefined &&
          got.quantity === value.quantity &&
          got.avgBuyPrice === value.avgBuyPrice
        );
      });
      if (!intact) return;
    }

    await ackRestoreHoldings(items.map((item) => item.assetKey));
  } catch {
    // شبکه، سرور یا دیسک — دفعه‌ی بعد دوباره امتحان می‌شود
  }
}
