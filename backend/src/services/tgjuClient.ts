// ارکستریتور منابع قیمت.
//
// خودِ گرفتن داده در priceSources.ts است؛ اینجا فقط تصمیم می‌گیریم کدام منبع
// استفاده شود، نتیجه یک دقیقه کش می‌شود، و سلامت هر منبع برای پنل ادمین
// نگه داشته می‌شود.

import { PRICE_PROVIDERS, ProviderQuote } from "./priceSources";

// تاریخچه از اینجا re-export می‌شود تا مسیرهای موجود (prices/market routes)
// دست‌نخورده بمانند.
export { fetchTgjuHistory, fetchTgjuDailyRows } from "./tgjuHistory";
export type { TgjuHistoryPoint, TgjuDailyRow } from "./tgjuHistory";

export interface TgjuQuote extends ProviderQuote {
  /** شناسه‌ی منبعی که این قیمت را داده — برای عیب‌یابی و نمایش در پنل ادمین */
  source: string;
}

export interface ProviderHealth {
  id: string;
  label: string;
  /** آیا آخرین تلاش موفق بود. null یعنی هنوز امتحان نشده (منبع اصلی جواب داد) */
  ok: boolean | null;
  lastTriedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  /** تعداد نمادی که در آخرین تلاش موفق برگرداند */
  symbolCount: number;
}

interface Snapshot {
  quotes: Map<string, TgjuQuote>;
  fetchedAt: number;
  /** منبعی که داده‌ی تازه را داد */
  sourceId: string;
  /** چند نماد در این snapshot تازه‌اند (بقیه از snapshot قبلی مانده‌اند) */
  freshCount: number;
}

let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

const SNAPSHOT_TTL_MS = 60_000;

/**
 * اگر قیمتِ یک منبع یدک بیش از این نسبت با آخرین قیمت شناخته‌شده فرق داشته
 * باشد، رد می‌شود. هدف گرفتنِ خطای واحد است (که ۱۰ یا ۱۰۰ برابر خطا می‌دهد،
 * یعنی ۹۰۰٪ و ۹۹۰۰٪) نه نوسان واقعی بازار — برای همین آستانه سخاوتمندانه است.
 */
const MAX_FALLBACK_DEVIATION = 0.5;

const health = new Map<string, ProviderHealth>(
  PRICE_PROVIDERS.map((p) => [
    p.id,
    {
      id: p.id,
      label: p.label,
      ok: null,
      lastTriedAt: null,
      lastSuccessAt: null,
      lastError: null,
      symbolCount: 0,
    },
  ])
);

function markTried(id: string) {
  const entry = health.get(id);
  if (entry) entry.lastTriedAt = new Date().toISOString();
}

function markSuccess(id: string, symbolCount: number) {
  const entry = health.get(id);
  if (!entry) return;
  entry.ok = true;
  entry.lastSuccessAt = new Date().toISOString();
  entry.lastError = null;
  entry.symbolCount = symbolCount;
}

function markFailure(id: string, error: string) {
  const entry = health.get(id);
  if (!entry) return;
  entry.ok = false;
  entry.lastError = error;
}

/**
 * قیمت‌های منبع یدک را با آخرین قیمت شناخته‌شده مقایسه می‌کند و آن‌هایی که
 * پرت‌اند را می‌اندازد. نمادهایی که سابقه‌ای ازشان نداریم بدون قضاوت می‌گذرند.
 */
function rejectImplausible(
  quotes: Map<string, ProviderQuote>,
  providerId: string
): Map<string, ProviderQuote> {
  const previous = snapshot?.quotes;
  if (!previous) return quotes;

  const kept = new Map<string, ProviderQuote>();
  for (const [symbol, quote] of quotes) {
    const before = previous.get(symbol)?.price;
    if (before && before > 0) {
      const deviation = Math.abs(quote.price - before) / before;
      if (deviation > MAX_FALLBACK_DEVIATION) {
        console.warn(
          `[prices] قیمت ${symbol} از ${providerId} رد شد: ${quote.price} در برابر ${before} (${Math.round(
            deviation * 100
          )}٪ اختلاف)`
        );
        continue;
      }
    }
    kept.set(symbol, quote);
  }
  return kept;
}

async function fetchSnapshot(neededSymbols: string[] | null): Promise<Snapshot> {
  let lastError: unknown = null;

  for (const [index, provider] of PRICE_PROVIDERS.entries()) {
    const isPrimary = index === 0;
    markTried(provider.id);

    try {
      const fetched = await provider.fetch(provider.bulk ? null : neededSymbols);
      // منابع یدک از فیلتر عبور می‌کنند تا یک خطای واحد بی‌صدا وارد پرتفوی نشود
      const accepted = isPrimary ? fetched : rejectImplausible(fetched, provider.id);
      if (accepted.size === 0) {
        throw new Error("هیچ قیمت قابل‌قبولی برنگشت");
      }

      const quotes = new Map<string, TgjuQuote>();
      // منبع یدک معمولاً فقط بخشی از نمادها را دارد؛ بقیه از snapshot قبلی
      // نگه داشته می‌شوند تا تب قیمت‌ها یک‌باره خالی نشود.
      if (!isPrimary && snapshot) {
        for (const [symbol, quote] of snapshot.quotes) quotes.set(symbol, quote);
      }
      for (const [symbol, quote] of accepted) {
        quotes.set(symbol, { ...quote, source: provider.id });
      }

      markSuccess(provider.id, accepted.size);
      if (!isPrimary) {
        console.warn(
          `[prices] منبع اصلی در دسترس نبود — ${accepted.size} قیمت از «${provider.label}» گرفته شد`
        );
      }

      return {
        quotes,
        fetchedAt: Date.now(),
        sourceId: provider.id,
        freshCount: accepted.size,
      };
    } catch (err) {
      lastError = err;
      markFailure(provider.id, (err as Error).message);
      console.warn(`[prices] منبع ${provider.id} ناموفق: ${(err as Error).message}`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("هیچ‌کدام از منابع قیمت در دسترس نبودند");
}

/**
 * آخرین وضعیت بازار. نتیجه برای یک دقیقه کش می‌شود تا هر درخواست کاربر یک
 * fetch جدید نزند، و درخواست‌های هم‌زمان روی یک fetch جمع می‌شوند.
 *
 * `neededSymbols` فقط وقتی به کار می‌آید که منبع اصلی قطع باشد و نوبت به
 * منابعی برسد که باید نماد به نماد بگیرند.
 */
export async function getMarketSnapshot(
  force = false,
  neededSymbols: string[] | null = null
): Promise<Map<string, TgjuQuote>> {
  const fresh =
    snapshot && Date.now() - snapshot.fetchedAt < SNAPSHOT_TTL_MS && !force;
  if (fresh) return snapshot!.quotes;

  if (!inflight) {
    inflight = fetchSnapshot(neededSymbols)
      .then((s) => {
        snapshot = s;
        return s;
      })
      .finally(() => {
        inflight = null;
      });
  }

  try {
    const s = await inflight;
    return s.quotes;
  } catch (err) {
    // اگر هیچ منبعی در دسترس نبود ولی داده‌ی قدیمی داریم، همان را بده —
    // قیمت کمی قدیمی خیلی بهتر از خطا دادن به کل اپ است.
    if (snapshot) {
      console.warn("[prices] استفاده از snapshot قدیمی — همه‌ی منابع ناموفق");
      return snapshot.quotes;
    }
    throw err;
  }
}

export function getSnapshotAge(): number | null {
  return snapshot ? Date.now() - snapshot.fetchedAt : null;
}

/** وضعیت همه‌ی منابع + اینکه داده‌ی فعلی از کدام آمده — برای پنل ادمین */
export function getSourceHealth(): {
  activeSourceId: string | null;
  primarySourceId: string;
  fetchedAgoMs: number | null;
  freshCount: number;
  totalCount: number;
  providers: ProviderHealth[];
} {
  return {
    activeSourceId: snapshot?.sourceId ?? null,
    primarySourceId: PRICE_PROVIDERS[0].id,
    fetchedAgoMs: getSnapshotAge(),
    freshCount: snapshot?.freshCount ?? 0,
    totalCount: snapshot?.quotes.size ?? 0,
    providers: PRICE_PROVIDERS.map((p) => health.get(p.id)!),
  };
}
