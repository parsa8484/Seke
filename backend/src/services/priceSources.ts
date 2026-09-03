// منابع قیمت — یک زنجیره‌ی قابل‌گسترش به‌جای یک اندپوینت تکی.
//
// چرا: تا قبل از این، کل اپ به `call*.tgju.org/ajax.json` وابسته بود. اگر آن
// یکی اندپوینت می‌مرد (دقیقاً بلایی که سر BrsApi آمد) هیچ قیمتی به‌روز نمی‌شد و
// فقط snapshot کهنه سرو می‌شد. حالا منابع به ترتیب امتحان می‌شوند و اولین
// منبعی که جواب بدهد برنده است.
//
// قرارداد مهم برای هر منبع جدید: `price` عددی است که در دیتابیس ذخیره می‌شود
// (تومان برای نمادهای ریالی، دلار برای دلاری‌ها، عدد خام برای شاخص‌ها) و `raw`
// همان عدد به «قرارداد خام tgju» است — یعنی برای واحد toman، مقدار ریالی.
// این invariant لازم است چون priceService وقتی ادمین واحد را دستی override
// کرده باشد، دوباره از `raw` حساب می‌کند.

import axios from "axios";
import { MarketUnit, parseTgjuNumber, toStoredPrice, unitForSymbol } from "./tgjuCatalog";
import { HTTP_HEADERS, fetchTgjuDailyRows } from "./tgjuHistory";

export interface ProviderQuote {
  symbol: string;
  /** عدد خام به قرارداد tgju (برای واحد toman یعنی ریال) */
  raw: number;
  /** عدد نهایی برای ذخیره/نمایش */
  price: number;
  unit: MarketUnit;
  high: number | null;
  low: number | null;
  change: number | null;
  changePercent: number | null;
  /** "high" | "low" | "" */
  direction: string;
  updatedAt: string | null;
}

export interface PriceProvider {
  id: string;
  label: string;
  /** true یعنی بدون لیست نماد هم می‌تواند کل بازار را برگرداند */
  bulk: boolean;
  /**
   * `symbols` فقط برای منابع غیر bulk معنی دارد: چون هر نماد یک درخواست جدا
   * می‌خواهد، نمی‌شود کل کاتالوگ را گرفت و باید بدانیم کدام‌ها لازم‌اند.
   */
  fetch(symbols: string[] | null): Promise<Map<string, ProviderQuote>>;
}

/** ساخت ProviderQuote از عدد خامِ ریالی/دلاری با واحد مشخص */
function quoteFromRaw(
  symbol: string,
  raw: number,
  unit: MarketUnit,
  extra: Partial<Omit<ProviderQuote, "symbol" | "raw" | "price" | "unit">> = {}
): ProviderQuote {
  return {
    symbol,
    raw,
    price: toStoredPrice(raw, unit),
    unit,
    high: extra.high ?? null,
    low: extra.low ?? null,
    change: extra.change ?? null,
    changePercent: extra.changePercent ?? null,
    direction: extra.direction ?? "",
    updatedAt: extra.updatedAt ?? null,
  };
}

/** "2026-07-31 14:11:15" (وقت تهران) → ISO. tgju آفست نمی‌دهد، خودمان می‌گذاریم. */
function tehranToIso(ts: unknown): string | null {
  if (typeof ts !== "string" || !ts.trim()) return null;
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const parsed = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+03:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

// --------------------------------------------------------------------------
// ۱) منبع اصلی: ajax.json روی زیردامنه‌های call*.tgju.org
// --------------------------------------------------------------------------

// tgju همین فایل را روی چند زیردامنه سرو می‌کند. بعضی‌هاشان از ایران/بعضی
// شبکه‌ها در دسترس نیستند، پس به ترتیب امتحان می‌شوند تا یکی جواب بدهد.
const AJAX_MIRRORS = [
  "https://call3.tgju.org/ajax.json",
  "https://call1.tgju.org/ajax.json",
  "https://call2.tgju.org/ajax.json",
  "https://call4.tgju.org/ajax.json",
  "https://www.tgju.org/ajax.json",
];

export const tgjuAjaxProvider: PriceProvider = {
  id: "tgju-ajax",
  label: "tgju (ajax.json)",
  bulk: true,
  async fetch() {
    let lastError: unknown = null;

    for (const url of AJAX_MIRRORS) {
      try {
        const { data } = await axios.get(url, {
          headers: HTTP_HEADERS,
          timeout: 15000,
        });
        const current = data?.current ?? data;
        if (!current || typeof current !== "object") {
          throw new Error("ساختار پاسخ tgju نامعتبر است");
        }

        const quotes = new Map<string, ProviderQuote>();
        for (const [symbol, item] of Object.entries<any>(current)) {
          const raw = parseTgjuNumber(item?.p);
          if (raw === null || raw <= 0) continue;

          const unit = unitForSymbol(symbol);
          const scale = (n: unknown) => {
            const parsed = parseTgjuNumber(n);
            return parsed === null ? null : toStoredPrice(parsed, unit);
          };

          quotes.set(
            symbol,
            quoteFromRaw(symbol, raw, unit, {
              high: scale(item?.h),
              low: scale(item?.l),
              change: scale(item?.d),
              changePercent:
                typeof item?.dp === "number" ? item.dp : parseTgjuNumber(item?.dp),
              direction: typeof item?.dt === "string" ? item.dt : "",
              updatedAt: tehranToIso(item?.ts),
            })
          );
        }
        if (quotes.size === 0) throw new Error("هیچ نمادی از tgju خوانده نشد");

        console.log(`[tgju-ajax] ${quotes.size} نماد از ${url} گرفته شد`);
        return quotes;
      } catch (err) {
        lastError = err;
        console.warn(`[tgju-ajax] ${url} ناموفق: ${(err as Error).message}`);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("دسترسی به هیچ‌کدام از میرورهای ajax.json ممکن نشد");
  },
};

// --------------------------------------------------------------------------
// ۲) یدک اول: api.tgju.org — همان شرکت، ولی زیرساخت و اندپوینت متفاوت
// --------------------------------------------------------------------------
//
// این همان اندپوینتی است که نمودارهای روند از آن می‌آیند و پوشش کاملی روی
// نمادها دارد، ولی هر نماد یک درخواست جداست. پس فقط برای تعداد محدودی نماد
// استفاده می‌شود: اول نمادهای مهم، بعد هرچه صداکننده لازم داشته باشد.
// عددها «آخرین کندلِ روزانه» هستند، نه لحظه‌ای — برای وقتی که منبع اصلی قطع
// است کاملاً قابل‌قبول است.

const MAX_FALLBACK_SYMBOLS = 40;
const FALLBACK_CONCURRENCY = 5;

/** نمادهایی که حتی وقتی صداکننده لیست نداده هم ارزش گرفتن دارند */
const PRIORITY_SYMBOLS = [
  "price_dollar_rl",
  "geram18",
  "geram24",
  "mesghal",
  "retail_sekee",
  "retail_nim",
  "retail_rob",
  "sekee",
  "ons",
  "usdt-irr",
  "silver_999",
];

export const tgjuApiProvider: PriceProvider = {
  id: "tgju-api",
  label: "api.tgju.org (کندل روزانه)",
  bulk: false,
  async fetch(symbols) {
    const wanted = [...new Set([...PRIORITY_SYMBOLS, ...(symbols ?? [])])].slice(
      0,
      MAX_FALLBACK_SYMBOLS
    );
    if (wanted.length === 0) throw new Error("لیست نماد برای منبع یدک خالی است");

    const quotes = new Map<string, ProviderQuote>();
    const settled = await mapWithConcurrency(
      wanted,
      FALLBACK_CONCURRENCY,
      async (symbol) => ({ symbol, rows: await fetchTgjuDailyRows(symbol) })
    );

    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      const { symbol, rows } = result.value;
      const today = rows[0];
      if (!today || today.close <= 0) continue;

      const unit = unitForSymbol(symbol);
      const previousClose = rows[1]?.close ?? null;
      const change =
        previousClose !== null ? toStoredPrice(today.close - previousClose, unit) : null;

      quotes.set(
        symbol,
        quoteFromRaw(symbol, today.close, unit, {
          high: toStoredPrice(today.high, unit),
          low: toStoredPrice(today.low, unit),
          change,
          changePercent:
            previousClose && previousClose > 0
              ? ((today.close - previousClose) / previousClose) * 100
              : null,
          direction: change === null || change === 0 ? "" : change > 0 ? "high" : "low",
          updatedAt: tehranToIso(`${today.date} 00:00:00`),
        })
      );
    }

    if (quotes.size === 0) throw new Error("api.tgju.org هیچ نمادی برنگرداند");
    console.log(`[tgju-api] ${quotes.size} نماد از api.tgju.org گرفته شد`);
    return quotes;
  },
};

// --------------------------------------------------------------------------
// ۳) یدک دوم: milli.gold — تنها منبع کاملاً مستقل از tgju
// --------------------------------------------------------------------------
//
// فقط طلای ۱۸ عیار می‌دهد، ولی چون هیچ ربطی به tgju ندارد تنها چیزی است که
// اگر کل tgju از دسترس خارج شود هنوز کار می‌کند. طلای ۱۸ لنگرِ قیمتی کل بازار
// طلا هم هست، پس حتی همین یک عدد بی‌ارزش نیست.
//
// واحدش تومان به‌ازای هر ۰.۰۱ گرم است (مثلاً 221530 یعنی ۲۲,۱۵۳,۰۰۰ تومان بر
// گرم) و حدود ۳٪ زیر قیمت خرده‌فروشی tgju در می‌آید. ضریب ۱۰۰ از مقایسه‌ی
// عملی به‌دست آمده، نه از مستندات — برای همین گاردِ انحرافِ tgjuClient روی
// همه‌ی منابع یدک اعمال می‌شود: اگر روزی واحدشان عوض شود عدد ۱۰۰ برابر غلط
// می‌شود و به‌جای اینکه بی‌صدا وارد پرتفوی کاربر شود، رد می‌شود.

const MILLI_TOMAN_PER_UNIT = 100;

export const milliGoldProvider: PriceProvider = {
  id: "milli-gold",
  label: "milli.gold (طلای ۱۸ عیار)",
  bulk: true,
  async fetch() {
    const { data } = await axios.get(
      "https://milli.gold/api/v1/public/milli-price/detail",
      { headers: HTTP_HEADERS, timeout: 15000 }
    );

    const price18 = parseTgjuNumber(data?.data?.price18);
    if (price18 === null || price18 <= 0) {
      throw new Error("پاسخ milli.gold قیمت طلای ۱۸ نداشت");
    }

    const toman = price18 * MILLI_TOMAN_PER_UNIT;
    const quotes = new Map<string, ProviderQuote>();
    // raw باید ریالی باشد تا invariant منبع‌ها حفظ شود (price = raw / 10)
    quotes.set(
      "geram18",
      quoteFromRaw("geram18", toman * 10, "toman", {
        updatedAt: tehranToIso(data?.data?.date),
      })
    );

    console.log(`[milli-gold] طلای ۱۸ عیار: ${toman} تومان`);
    return quotes;
  },
};

/** ترتیب امتحان‌شدن منابع. اولی منبع اصلی است، بقیه یدک. */
export const PRICE_PROVIDERS: PriceProvider[] = [
  tgjuAjaxProvider,
  tgjuApiProvider,
  milliGoldProvider,
];
