// تاریخچه‌ی روزانه‌ی نمادهای tgju.
//
// این فایل از tgjuClient جدا شد تا priceSources بتواند از آن استفاده کند بدون
// اینکه یک import حلقه‌ای (tgjuClient → priceSources → tgjuClient) درست شود.
//
// کش روی ردیف‌های *خام* است، نه مقیاس‌شده: هم مسیر نمودار و هم منبع یدکِ
// api.tgju.org از همین ردیف‌ها می‌خوانند و هرکدام خودش واحد را اعمال می‌کند.

import axios from "axios";
import { parseTgjuNumber, toStoredPrice, unitForSymbol } from "./tgjuCatalog";

export const HTTP_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8",
  Accept: "application/json, text/plain, */*",
};

/** یک ردیف روزانه با عددهای خام (بدون تقسیم بر ۱۰) — جدیدترین روز اول است */
export interface TgjuDailyRow {
  /** تاریخ میلادی ISO (فقط روز) */
  date: string;
  /** تاریخ شمسی به‌صورت "1405/05/08" — خود tgju می‌دهد */
  jdate: string;
  open: number;
  low: number;
  high: number;
  close: number;
}

/** همان ردیف، ولی با واحد نهایی (ریالی‌ها تقسیم بر ۱۰ شده‌اند) */
export interface TgjuHistoryPoint {
  date: string;
  jdate: string;
  open: number;
  low: number;
  high: number;
  close: number;
}

const rowCache = new Map<string, { rows: TgjuDailyRow[]; fetchedAt: number }>();
const HISTORY_TTL_MS = 30 * 60 * 1000;

/**
 * ردیف‌های روزانه‌ی خام یک نماد از api.tgju.org.
 *
 * این اندپوینت کل تاریخچه (گاهی چند هزار روز) را می‌دهد و ردیف اول جدیدترین
 * روز است. ستون‌ها:
 *   [open, low, high, close, تغییر(HTML), درصد(HTML), میلادی, شمسی]
 */
export async function fetchTgjuDailyRows(
  symbol: string
): Promise<TgjuDailyRow[]> {
  const cached = rowCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < HISTORY_TTL_MS) {
    return cached.rows;
  }

  const { data } = await axios.get(
    `https://api.tgju.org/v1/market/indicator/summary-table-data/${encodeURIComponent(
      symbol
    )}`,
    { headers: HTTP_HEADERS, timeout: 20000 }
  );

  const raw: unknown[] = Array.isArray(data?.data) ? data.data : [];
  const rows: TgjuDailyRow[] = [];

  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 8) continue;
    const open = parseTgjuNumber(row[0]);
    const low = parseTgjuNumber(row[1]);
    const high = parseTgjuNumber(row[2]);
    const close = parseTgjuNumber(row[3]);
    const gregorian = String(row[6] ?? "").replace(/\//g, "-");
    const jdate = String(row[7] ?? "");
    if (open === null || close === null || !gregorian) continue;

    rows.push({
      date: gregorian,
      jdate,
      open,
      low: low ?? open,
      high: high ?? open,
      close,
    });
  }

  rowCache.set(symbol, { rows, fetchedAt: Date.now() });
  return rows;
}

/** تاریخچه‌ی روزانه با واحد نهایی — جدیدترین روز اول */
export async function fetchTgjuHistory(
  symbol: string,
  days: number
): Promise<TgjuHistoryPoint[]> {
  const rows = await fetchTgjuDailyRows(symbol);
  const unit = unitForSymbol(symbol);
  return rows.slice(0, days).map((r) => ({
    date: r.date,
    jdate: r.jdate,
    open: toStoredPrice(r.open, unit),
    low: toStoredPrice(r.low, unit),
    high: toStoredPrice(r.high, unit),
    close: toStoredPrice(r.close, unit),
  }));
}
