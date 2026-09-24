import { fetchAssetHistory } from "../api/prices";
import { HoldingItem, PortfolioHistory } from "../api/types";
import {
  PortfolioSeries,
  aggregatePortfolioSeries,
} from "./portfolioSeries";

/**
 * روند ارزش کل پرتفوی — همان محاسبه‌ای که قبلاً `GET /api/holdings/history`
 * روی سرور انجام می‌داد، حالا روی گوشی.
 *
 * معنی عددها عوض نشده: «اگر همین تعدادی که الان داری را آن روز داشتی، چقدر
 * می‌ارزید». چون جدول تراکنش (خرید/فروش با تاریخ) نداریم، تعداد فعلی در قیمت
 * تاریخی هر روز ضرب می‌شود.
 *
 * تفاوت با قبل فقط در جای اجراست: به‌جای یک درخواست، برای هر دارایی‌ای که
 * تعدادش بیشتر از صفر است یک بار `/api/prices/:key/history` صدا زده می‌شود
 * (معمولاً ۳ تا ۶ تا) که همگی از کش ۳۰ دقیقه‌ای سرور می‌آیند. خودِ جمع زدن در
 * `portfolioSeries.ts` است تا بدون شبکه قابل تست باشد.
 */
export async function buildPortfolioHistory(
  owned: HoldingItem[],
  days: number
): Promise<PortfolioHistory> {
  if (owned.length === 0) {
    return { days, points: [], assetCount: 0, missingHistory: [] };
  }

  // تاریخ شمسیِ آماده‌ی هر روز را از هر دارایی‌ای که داشته باشد برمی‌داریم تا
  // لازم نباشد دوباره میلادی→شمسی حساب شود.
  const jdateByDate = new Map<string, string>();

  const series: PortfolioSeries[] = await Promise.all(
    owned.map(async (item) => {
      const base: PortfolioSeries = {
        label: item.label,
        quantity: item.quantity,
        currentPrice: item.price ?? 0,
        dates: [],
        prices: [],
      };

      try {
        const history = await fetchAssetHistory(item.assetKey, days);
        const points = history.points.slice(-days);
        for (const point of points) {
          if (point.jdate) jdateByDate.set(point.date, point.jdate);
        }
        return {
          ...base,
          dates: points.map((p) => p.date),
          prices: points.map((p) => p.price),
        };
      } catch {
        // دارایی دستی یا خطای شبکه: با قیمت فعلی ثابت در نظر گرفته می‌شود
        return base;
      }
    })
  );

  return aggregatePortfolioSeries(series, days, jdateByDate);
}
