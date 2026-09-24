import { fetchAssetHistory } from "../api/prices";
import { HoldingItem, PortfolioHistory } from "../api/types";

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
 * (معمولاً ۳ تا ۶ تا) که همگی از کش ۳۰ دقیقه‌ای سرور می‌آیند.
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

  const series = await Promise.all(
    owned.map(async (item) => {
      const base = {
        label: item.label,
        quantity: item.quantity,
        currentPrice: item.price ?? 0,
        dates: [] as string[],
        prices: [] as number[],
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

  const missingHistory = series
    .filter((s) => s.dates.length === 0)
    .map((s) => s.label);

  // محور زمان = اجتماع روزهای همه‌ی دارایی‌ها (هر نماد ممکن است تعطیلات
  // متفاوتی داشته باشد)، آخرین `days` روز.
  const axis = [...new Set(series.flatMap((s) => s.dates))].sort().slice(-days);

  if (axis.length < 2) {
    return { days, points: [], assetCount: owned.length, missingHistory };
  }

  // برای هر دارایی یک اشاره‌گر همراه محور جلو می‌رود؛ اگر آن روز قیمتی ثبت
  // نشده باشد، آخرین قیمت شناخته‌شده ادامه پیدا می‌کند.
  const cursors = series.map(() => 0);
  const points = axis.map((date) => {
    let value = 0;
    series.forEach((s, i) => {
      if (s.dates.length === 0) {
        value += s.quantity * s.currentPrice;
        return;
      }
      let index = cursors[i];
      while (index + 1 < s.dates.length && s.dates[index + 1] <= date) index++;
      cursors[i] = index;
      value += s.quantity * s.prices[index];
    });
    return { date, jdate: jdateByDate.get(date) ?? null, price: value };
  });

  return { days, points, assetCount: owned.length, missingHistory };
}
