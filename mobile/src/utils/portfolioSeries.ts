import { PortfolioHistory } from "../api/types";

/** یک دارایی با تاریخچه‌ی روزانه‌اش، آماده‌ی جمع زدن */
export interface PortfolioSeries {
  label: string;
  quantity: number;
  /** برای وقتی تاریخچه ندارد: همان قیمت امروز، ثابت */
  currentPrice: number;
  /** قدیم → جدید */
  dates: string[];
  prices: number[];
}

/**
 * ریاضیِ خالصِ نمودار ارزش پرتفوی — بدون شبکه، تا بشود مستقل تستش کرد.
 *
 * محور زمان = اجتماع روزهای معاملاتی همه‌ی دارایی‌ها، چون هر نماد تعطیلات
 * خودش را دارد. هر دارایی آخرین قیمت شناخته‌شده‌اش را در روزهای خالی ادامه
 * می‌دهد (carry-forward) و قبل از اولین داده‌اش با همان اولین قیمت پر می‌شود.
 */
export function aggregatePortfolioSeries(
  series: PortfolioSeries[],
  days: number,
  jdateByDate: Map<string, string> = new Map()
): PortfolioHistory {
  const missingHistory = series
    .filter((s) => s.dates.length === 0)
    .map((s) => s.label);

  const axis = [...new Set(series.flatMap((s) => s.dates))].sort().slice(-days);

  if (axis.length < 2) {
    return { days, points: [], assetCount: series.length, missingHistory };
  }

  // برای هر دارایی یک اشاره‌گر همراه محور جلو می‌رود
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

  return { days, points, assetCount: series.length, missingHistory };
}
