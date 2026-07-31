import axios from "axios";
import {
  MarketUnit,
  parseTgjuNumber,
  toStoredPrice,
  unitForSymbol,
} from "./tgjuCatalog";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8",
  Accept: "application/json, text/plain, */*",
};

// tgju همین فایل رو روی چند زیردامنه سرو می‌کنه. بعضی‌هاشون از ایران/بعضی
// شبکه‌ها در دسترس نیستن، پس به ترتیب امتحان می‌شن تا یکی جواب بده.
const AJAX_MIRRORS = [
  "https://call3.tgju.org/ajax.json",
  "https://call1.tgju.org/ajax.json",
  "https://call2.tgju.org/ajax.json",
  "https://call4.tgju.org/ajax.json",
  "https://www.tgju.org/ajax.json",
];

export interface TgjuQuote {
  symbol: string;
  /** قیمت خام همان‌طور که tgju می‌دهد (ریالی برای نمادهای داخلی) */
  raw: number;
  /** قیمت نهایی برای ذخیره/نمایش: ریالی‌ها تقسیم بر ۱۰ شده‌اند */
  price: number;
  unit: MarketUnit;
  high: number | null;
  low: number | null;
  /** تغییر نسبت به روز قبل، با همان واحد price */
  change: number | null;
  changePercent: number | null;
  /** "high" | "low" | "" — جهت تغییر طبق خود tgju */
  direction: string;
  /** زمان آخرین تغییر قیمت طبق tgju (ISO) */
  updatedAt: string | null;
}

interface Snapshot {
  quotes: Map<string, TgjuQuote>;
  fetchedAt: number;
}

let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

const SNAPSHOT_TTL_MS = 60_000;

function toIso(ts: unknown): string | null {
  if (typeof ts !== "string" || !ts.trim()) return null;
  // فرمت tgju: "2026-07-31 14:11:15" (وقت تهران). به ISO با آفست +03:30
  // تبدیل می‌شه تا کلاینت بتونه درست به شمسی/محلی نشون بده.
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}+03:30`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildQuote(symbol: string, item: any): TgjuQuote | null {
  const raw = parseTgjuNumber(item?.p);
  if (raw === null || raw <= 0) return null;

  const unit = unitForSymbol(symbol);
  const scale = (n: number | null) => (n === null ? null : toStoredPrice(n, unit));

  return {
    symbol,
    raw,
    price: toStoredPrice(raw, unit),
    unit,
    high: scale(parseTgjuNumber(item?.h)),
    low: scale(parseTgjuNumber(item?.l)),
    change: scale(parseTgjuNumber(item?.d)),
    changePercent:
      typeof item?.dp === "number" ? item.dp : parseTgjuNumber(item?.dp),
    direction: typeof item?.dt === "string" ? item.dt : "",
    updatedAt: toIso(item?.ts),
  };
}

async function fetchSnapshot(): Promise<Snapshot> {
  let lastError: unknown = null;

  for (const url of AJAX_MIRRORS) {
    try {
      const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const current = data?.current ?? data;
      if (!current || typeof current !== "object") {
        throw new Error("ساختار پاسخ tgju نامعتبر است");
      }

      const quotes = new Map<string, TgjuQuote>();
      for (const [symbol, item] of Object.entries(current)) {
        const quote = buildQuote(symbol, item);
        if (quote) quotes.set(symbol, quote);
      }
      if (quotes.size === 0) throw new Error("هیچ نمادی از tgju خوانده نشد");

      console.log(`[tgju] ${quotes.size} نماد از ${url} گرفته شد`);
      return { quotes, fetchedAt: Date.now() };
    } catch (err) {
      lastError = err;
      console.warn(`[tgju] ${url} ناموفق: ${(err as Error).message}`);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("دسترسی به tgju ممکن نشد");
}

/**
 * آخرین وضعیت بازار. نتیجه برای یک دقیقه کش می‌شه تا هر درخواست کاربر
 * یک fetch جدید به tgju نزنه، و درخواست‌های هم‌زمان هم روی یک fetch جمع می‌شن.
 */
export async function getMarketSnapshot(
  force = false
): Promise<Map<string, TgjuQuote>> {
  const fresh =
    snapshot && Date.now() - snapshot.fetchedAt < SNAPSHOT_TTL_MS && !force;
  if (fresh) return snapshot!.quotes;

  if (!inflight) {
    inflight = fetchSnapshot()
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
    // اگر tgju در دسترس نبود ولی داده‌ی قدیمی داریم، همون رو بده —
    // قیمت کمی قدیمی خیلی بهتر از خطا دادن به کل اپه.
    if (snapshot) {
      console.warn("[tgju] استفاده از snapshot قدیمی به‌دلیل خطای شبکه");
      return snapshot.quotes;
    }
    throw err;
  }
}

export function getSnapshotAge(): number | null {
  return snapshot ? Date.now() - snapshot.fetchedAt : null;
}

// ---------------------------- تاریخچه‌ی قیمت ----------------------------

export interface TgjuHistoryPoint {
  /** تاریخ میلادی ISO (فقط روز) */
  date: string;
  /** تاریخ شمسی به‌صورت "1405/05/08" — خود tgju می‌ده */
  jdate: string;
  open: number;
  low: number;
  high: number;
  close: number;
}

const historyCache = new Map<
  string,
  { points: TgjuHistoryPoint[]; fetchedAt: number }
>();
const HISTORY_TTL_MS = 30 * 60 * 1000;

/**
 * تاریخچه‌ی روزانه‌ی یک نماد از tgju. این اندپوینت کل تاریخچه (گاهی چند هزار
 * روز) رو می‌ده و ردیف اول جدیدترین روزه. ستون‌ها:
 *   [open, low, high, close, تغییر(HTML), درصد(HTML), میلادی, شمسی]
 */
export async function fetchTgjuHistory(
  symbol: string,
  days: number
): Promise<TgjuHistoryPoint[]> {
  const cached = historyCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < HISTORY_TTL_MS) {
    return cached.points.slice(0, days);
  }

  const { data } = await axios.get(
    `https://api.tgju.org/v1/market/indicator/summary-table-data/${encodeURIComponent(
      symbol
    )}`,
    { headers: HEADERS, timeout: 20000 }
  );

  const rows: unknown[] = Array.isArray(data?.data) ? data.data : [];
  const unit = unitForSymbol(symbol);
  const points: TgjuHistoryPoint[] = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 8) continue;
    const open = parseTgjuNumber(row[0]);
    const low = parseTgjuNumber(row[1]);
    const high = parseTgjuNumber(row[2]);
    const close = parseTgjuNumber(row[3]);
    const gregorian = String(row[6] ?? "").replace(/\//g, "-");
    const jdate = String(row[7] ?? "");
    if (open === null || close === null || !gregorian) continue;

    points.push({
      date: gregorian,
      jdate,
      open: toStoredPrice(open, unit),
      low: toStoredPrice(low ?? open, unit),
      high: toStoredPrice(high ?? open, unit),
      close: toStoredPrice(close, unit),
    });
  }

  historyCache.set(symbol, { points, fetchedAt: Date.now() });
  return points.slice(0, days);
}
