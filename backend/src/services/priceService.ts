import axios from "axios";
import * as cheerio from "cheerio";
import { prisma } from "../db";
import { config } from "../config";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8",
};

// برای دارایی‌های sourceType="tgju": مقدار sourceRef همون data-market-row
// صفحه‌ی tgju.org هست (مثلا "retail_sekee"). این تابع کاملاً داده‌محوره -
// هر دارایی جدیدی که ادمین با sourceType=tgju اضافه کنه، خودکار پوشش داده می‌شه.
async function fetchTgjuPrices(
  assets: { key: string; sourceRef: string | null }[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const targets = assets.filter((a) => a.sourceRef);
  if (targets.length === 0) return result;

  try {
    const { data: html } = await axios.get("https://www.tgju.org/", {
      headers: HEADERS,
      timeout: 15000,
    });
    const $ = cheerio.load(html);

    for (const asset of targets) {
      const row = $(`[data-market-row="${asset.sourceRef}"]`);
      if (!row.length) continue;
      const priceText = row.find("td").eq(0).text().trim().replace(/,/g, "");
      const rialPrice = Number(priceText);
      if (!Number.isNaN(rialPrice) && rialPrice > 0) {
        // tgju.org این ردیف‌ها را به ریال نمایش می‌دهد (تأیید شده روی HTML واقعی
        // صفحه: data-market-name="p" با مقدار خام ریالی). کل سیستم ما تومان
        // ذخیره می‌کند، پس تقسیم بر ۱۰ لازم است.
        result[asset.key] = rialPrice / 10;
      }
    }
  } catch (err) {
    console.error("[priceService] tgju fetch failed:", (err as Error).message);
  }
  return result;
}

function extractPrice(item: any): number | null {
  for (const key of ["pc", "pl", "price", "value", "nav", "final", "close"]) {
    if (item?.[key] !== undefined && item[key] !== null) {
      const n = Number(item[key]);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

// برای دارایی‌های sourceType="brsapi": مقدار sourceRef یک تکه از نام فارسی
// نماد در BrsApi هست (مثلا "کهربا") که برای پیدا کردن ردیف مربوطه استفاده می‌شه.
async function fetchBrsApiPrices(
  assets: { key: string; sourceRef: string | null }[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const targets = assets.filter((a) => a.sourceRef);
  if (targets.length === 0) return result;

  if (!config.brsapiKey) {
    console.warn("[priceService] BRSAPI_KEY تنظیم نشده - قیمت صندوق‌ها رد شد");
    return result;
  }
  try {
    const { data } = await axios.get(
      "https://BrsApi.ir/Api/Tsetmc/AllSymbols.php",
      { params: { key: config.brsapiKey, type: 1 }, timeout: 15000 }
    );

    const list: any[] =
      data?.gold ?? data?.data ?? data?.items ?? data?.result ?? data ?? [];

    if (Array.isArray(list)) {
      for (const item of list) {
        const name: string = item?.l18 ?? item?.name ?? item?.symbol ?? "";
        for (const asset of targets) {
          if (asset.sourceRef && name.includes(asset.sourceRef)) {
            const price = extractPrice(item);
            if (price) result[asset.key] = price;
          }
        }
      }
    }
  } catch (err) {
    console.error(
      "[priceService] BrsApi fetch failed:",
      (err as Error).message
    );
  }
  return result;
}

/**
 * قیمت‌های آنلاین دارایی‌های فعال را (بر اساس sourceType هرکدام) می‌گیرد،
 * در جدول Asset کش می‌کند و یک ردیف در PriceHistory برای هرکدام ثبت می‌کند.
 */
export async function refreshPrices(): Promise<{ updated: number }> {
  const assets = await prisma.asset.findMany({
    where: { isActive: true, sourceType: { in: ["tgju", "brsapi"] } },
    select: { id: true, key: true, sourceType: true, sourceRef: true },
  });

  const tgjuAssets = assets.filter((a) => a.sourceType === "tgju");
  const brsapiAssets = assets.filter((a) => a.sourceType === "brsapi");

  const [coinPrices, fundPrices] = await Promise.all([
    fetchTgjuPrices(tgjuAssets),
    fetchBrsApiPrices(brsapiAssets),
  ]);
  const allPrices: Record<string, number> = { ...coinPrices, ...fundPrices };

  let updated = 0;
  for (const asset of assets) {
    const price = allPrices[asset.key];
    if (price === undefined) continue;

    await prisma.asset.update({
      where: { id: asset.id },
      data: { currentPrice: price, priceUpdatedAt: new Date() },
    });
    await prisma.priceHistory.create({
      data: { assetId: asset.id, price },
    });
    updated++;
  }

  console.log(`[priceService] قیمت ${updated} دارایی به‌روزرسانی شد`);
  return { updated };
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
