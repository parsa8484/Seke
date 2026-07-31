import { prisma } from "../db";
import { config } from "../config";
import { getMarketSnapshot } from "./tgjuClient";
import { MarketUnit, toStoredPrice, unitForSymbol } from "./tgjuCatalog";
import { evaluatePriceAlerts } from "./alertService";

/**
 * قیمت دارایی‌های فعالِ متصل به tgju را می‌گیرد، در Asset کش می‌کند و یک ردیف
 * در PriceHistory ثبت می‌کند.
 *
 * از نسخه‌ی قبل دو تفاوت مهم دارد:
 *  ۱) دیگر HTML صفحه‌ی tgju اسکرپ نمی‌شود؛ از ajax.json رسمی و رایگان می‌خوانیم.
 *     پس هک `sourceRef = "crypto-bitcoin#1"` (تکرار n اُم ردیف) لازم نیست —
 *     در ajax.json نسخه‌ی دلاری و ریالی کلید جدا دارند (crypto-bitcoin و
 *     crypto-bitcoin-irr).
 *  ۲) BrsApi حذف شده؛ صندوق‌های طلا هم از همین منبع (ime_fund_*) می‌آیند.
 */
export async function refreshPrices(): Promise<{
  updated: number;
  skipped: number;
  error?: string;
}> {
  const assets = await prisma.asset.findMany({
    where: { isActive: true, sourceType: "tgju" },
    select: {
      id: true,
      key: true,
      sourceRef: true,
      priceUnit: true,
      currentPrice: true,
    },
  });
  if (assets.length === 0) return { updated: 0, skipped: 0 };

  let quotes;
  try {
    quotes = await getMarketSnapshot(true);
  } catch (err) {
    const error = (err as Error).message;
    console.error("[priceService] گرفتن قیمت از tgju ناموفق:", error);
    return { updated: 0, skipped: assets.length, error };
  }

  let updated = 0;
  let skipped = 0;
  const changed: { assetId: string; price: number }[] = [];

  for (const asset of assets) {
    if (!asset.sourceRef) {
      skipped++;
      continue;
    }
    const quote = quotes.get(asset.sourceRef);
    if (!quote) {
      skipped++;
      continue;
    }

    // اگر ادمین واحد را صریح تعیین کرده به آن احترام بگذار، وگرنه از کاتالوگ.
    // (quote.price قبلاً با واحدِ کاتالوگ حساب شده، پس فقط وقتی ادمین چیز
    // دیگری گفته دوباره از roh حساب می‌کنیم.)
    const explicitUnit = (asset.priceUnit as MarketUnit | null) ?? null;
    const price =
      explicitUnit && explicitUnit !== unitForSymbol(asset.sourceRef)
        ? toStoredPrice(quote.raw, explicitUnit)
        : quote.price;

    await prisma.asset.update({
      where: { id: asset.id },
      data: { currentPrice: price, priceUpdatedAt: new Date() },
    });
    await prisma.priceHistory.create({ data: { assetId: asset.id, price } });
    changed.push({ assetId: asset.id, price });
    updated++;
  }

  console.log(
    `[priceService] قیمت ${updated} دارایی به‌روزرسانی شد (${skipped} بدون داده)`
  );

  // هشدارهای قیمت را بعد از به‌روزرسانی بررسی کن — خطای اینجا نباید
  // به‌روزرسانی قیمت‌ها را خراب کند.
  try {
    await evaluatePriceAlerts(changed);
  } catch (err) {
    console.error("[priceService] بررسی هشدارها ناموفق:", (err as Error).message);
  }

  return { updated, skipped };
}

let refreshTimer: NodeJS.Timeout | null = null;

export function startPriceRefreshLoop(): void {
  // یک بار در استارت‌آپ، بعد هر N دقیقه طبق تنظیمات
  refreshPrices().catch((e) => console.error(e));
  const intervalMs = config.priceRefreshMinutes * 60 * 1000;
  refreshTimer = setInterval(() => {
    refreshPrices().catch((e) => console.error(e));
  }, intervalMs);
}

export function stopPriceRefreshLoop(): void {
  if (refreshTimer) clearInterval(refreshTimer);
}
