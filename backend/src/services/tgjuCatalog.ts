// کاتالوگ نمادهای tgju
//
// منبع همه‌ی قیمت‌ها یک اندپوینت رایگان و بدون کلیده:
//   https://call3.tgju.org/ajax.json
// که ~۹۳۰ نماد رو با ساختار { p, h, l, d, dp, dt, t, ts } برمی‌گردونه.
//
// مهم‌ترین نکته‌ی این فایل «واحد» هر نماده. tgju سه جور عدد می‌ده:
//   toman → عدد ریالیه و باید تقسیم بر ۱۰ بشه (دلار، سکه، طلا، صندوق‌ها، ...)
//   usd   → عدد دلاریه و همون‌طور می‌مونه (انس، بیت‌کوین، نفت، فلزات)
//   point → واحد نداره، عدد شاخصه (S&P 500، شاخص کل بورس)
// اشتباه در این طبقه‌بندی *بی‌صدا* خرابی می‌سازه: قیمت دلاری تقسیم بر ۱۰ هم
// یک عدد باورپذیر به‌نظر می‌رسه. برای همین واحد هر نماد اینجا صریح نوشته شده،
// نه با حدس از روی اسم.

export type MarketUnit = "toman" | "usd" | "point";

export interface TgjuSymbolMeta {
  symbol: string; // کلید در ajax.json
  label: string; // نام فارسی برای نمایش
  category: MarketCategory;
  unit: MarketUnit;
}

export type MarketCategory =
  | "currency"
  | "gold"
  | "coin"
  | "fund"
  | "crypto"
  | "global";

export const MARKET_CATEGORY_LABELS: Record<MarketCategory, string> = {
  currency: "ارز",
  gold: "طلا و نقره",
  coin: "سکه",
  fund: "صندوق طلا و نقره",
  crypto: "رمزارز",
  global: "بازارهای جهانی",
};

// ترتیب نمایش دسته‌ها در تب قیمت‌ها
export const MARKET_CATEGORY_ORDER: MarketCategory[] = [
  "currency",
  "gold",
  "coin",
  "fund",
  "crypto",
  "global",
];

const C = (
  symbol: string,
  label: string,
  category: MarketCategory,
  unit: MarketUnit
): TgjuSymbolMeta => ({ symbol, label, category, unit });

export const TGJU_CATALOG: TgjuSymbolMeta[] = [
  // ------------------------------- ارز -------------------------------
  C("price_dollar_rl", "دلار آمریکا", "currency", "toman"),
  C("price_eur", "یورو", "currency", "toman"),
  C("price_gbp", "پوند انگلیس", "currency", "toman"),
  C("price_aed", "درهم امارات", "currency", "toman"),
  C("price_try", "لیر ترکیه", "currency", "toman"),
  C("price_cny", "یوان چین", "currency", "toman"),
  C("price_jpy", "ین ژاپن", "currency", "toman"),
  C("price_cad", "دلار کانادا", "currency", "toman"),
  C("price_aud", "دلار استرالیا", "currency", "toman"),
  C("price_chf", "فرانک سوئیس", "currency", "toman"),
  C("price_rub", "روبل روسیه", "currency", "toman"),
  C("price_iqd", "دینار عراق", "currency", "toman"),
  C("price_kwd", "دینار کویت", "currency", "toman"),
  C("price_sar", "ریال عربستان", "currency", "toman"),
  C("price_qar", "ریال قطر", "currency", "toman"),
  C("price_omr", "ریال عمان", "currency", "toman"),
  C("price_bhd", "دینار بحرین", "currency", "toman"),
  C("price_afn", "افغانی", "currency", "toman"),
  C("price_inr", "روپیه هند", "currency", "toman"),
  C("price_pkr", "روپیه پاکستان", "currency", "toman"),
  C("price_myr", "رینگیت مالزی", "currency", "toman"),
  C("price_thb", "بات تایلند", "currency", "toman"),
  C("price_sgd", "دلار سنگاپور", "currency", "toman"),
  C("price_hkd", "دلار هنگ‌کنگ", "currency", "toman"),
  C("price_krw", "وون کره جنوبی", "currency", "toman"),
  C("price_sek", "کرون سوئد", "currency", "toman"),
  C("price_nok", "کرون نروژ", "currency", "toman"),
  C("price_dkk", "کرون دانمارک", "currency", "toman"),
  C("price_azn", "منات آذربایجان", "currency", "toman"),
  C("price_amd", "درام ارمنستان", "currency", "toman"),
  C("price_gel", "لاری گرجستان", "currency", "toman"),
  C("price_tjs", "سومونی تاجیکستان", "currency", "toman"),
  C("price_tmt", "منات ترکمنستان", "currency", "toman"),
  C("price_kzt", "تنگه قزاقستان", "currency", "toman"),
  C("price_egp", "پوند مصر", "currency", "toman"),
  C("price_syp", "لیر سوریه", "currency", "toman"),
  C("price_dollar_dt", "دلار حواله", "currency", "toman"),
  C("price_eur_ex", "یورو (صرافی)", "currency", "toman"),
  C("price_dollar_ex", "دلار (صرافی)", "currency", "toman"),
  C("usdt-irr", "تتر (USDT)", "currency", "toman"),

  // ------------------------- طلا و نقره -------------------------
  C("geram18", "طلای ۱۸ عیار (گرم)", "gold", "toman"),
  C("geram24", "طلای ۲۴ عیار (گرم)", "gold", "toman"),
  C("gold_17", "طلای ۱۷ عیار (گرم)", "gold", "toman"),
  C("mesghal", "مثقال طلا", "gold", "toman"),
  C("gold_melted_wholesale", "طلای آب‌شده (نقدی)", "gold", "toman"),
  C("gold_melted_transfer", "طلای آب‌شده (حواله)", "gold", "toman"),
  C("gold_740k", "طلای دست دوم (۷۴۰)", "gold", "toman"),
  C("tgju_gold_irg18", "شاخص طلای ۱۸ عیار tgju", "gold", "toman"),
  C("silver_999", "نقره ۹۹۹ (گرم)", "gold", "toman"),
  C("silver_925", "نقره ۹۲۵ (گرم)", "gold", "toman"),
  C("ons", "انس جهانی طلا", "gold", "usd"),
  C("silver", "انس جهانی نقره", "gold", "usd"),
  C("platinum", "انس پلاتین", "gold", "usd"),
  C("palladium", "انس پالادیوم", "gold", "usd"),

  // ------------------------------ سکه ------------------------------
  C("retail_sekee", "سکه امامی (خرده‌فروشی)", "coin", "toman"),
  C("retail_sekeb", "سکه بهار آزادی (خرده‌فروشی)", "coin", "toman"),
  C("retail_nim", "نیم سکه (خرده‌فروشی)", "coin", "toman"),
  C("retail_rob", "ربع سکه (خرده‌فروشی)", "coin", "toman"),
  C("retail_gerami", "سکه گرمی (خرده‌فروشی)", "coin", "toman"),
  C("sekee", "سکه امامی (عمده)", "coin", "toman"),
  C("sekeb", "سکه بهار آزادی (عمده)", "coin", "toman"),
  C("nim", "نیم سکه (عمده)", "coin", "toman"),
  C("rob", "ربع سکه (عمده)", "coin", "toman"),
  C("gerami", "سکه گرمی (عمده)", "coin", "toman"),
  C("sekee_real", "سکه امامی (ارزش ذاتی)", "coin", "toman"),

  // -------------------- صندوق‌های طلا و نقره --------------------
  // اینها همون صندوق‌هایی هستن که قبلاً از BrsApi می‌اومدن و از کار افتاد.
  C("ime_fund_kahroba", "صندوق طلای کهربا", "fund", "toman"),
  C("ime_fund_ayar", "صندوق طلای عیار", "fund", "toman"),
  C("ime_fund_gohar", "صندوق طلای گوهر", "fund", "toman"),
  C("ime_fund_zar", "صندوق طلای زر", "fund", "toman"),
  C("ime_fund_mesghal", "صندوق طلای مثقال", "fund", "toman"),
  C("ime_fund_ganj", "صندوق طلای گنج", "fund", "toman"),
  C("ime_fund_lotus", "صندوق طلای لوتوس", "fund", "toman"),
  C("ime_fund_zomorod", "صندوق طلای زمرد", "fund", "toman"),
  C("ime_fund_javaher", "صندوق طلای جواهر", "fund", "toman"),
  C("ime_fund_naab", "صندوق طلای ناب", "fund", "toman"),
  C("ime_fund_nafis", "صندوق طلای نفیس", "fund", "toman"),
  C("ime_fund_alton", "صندوق طلای آلتون", "fund", "toman"),
  C("ime_fund_atash", "صندوق طلای آتش", "fund", "toman"),
  C("ime_fund_tabesh", "صندوق طلای تابش", "fund", "toman"),
  C("ime_fund_dorna", "صندوق طلای درنا", "fund", "toman"),
  C("ime_fund_derakhshan", "صندوق طلای درخشان", "fund", "toman"),
  C("ime_fund_goldis", "صندوق طلای گلدیس", "fund", "toman"),
  C("ime_fund_golda", "صندوق طلای گلدا", "fund", "toman"),
  C("ime_fund_hamiyan", "صندوق طلای حامیان", "fund", "toman"),
  C("ime_fund_jaam_tala", "صندوق طلای جام طلا", "fund", "toman"),
  C("ime_fund_liyan", "صندوق طلای لیان", "fund", "toman"),
  C("ime_fund_miras", "صندوق طلای میراث", "fund", "toman"),
  C("ime_fund_nahal", "صندوق طلای نهال", "fund", "toman"),
  C("ime_fund_negin_fars", "صندوق طلای نگین فارس", "fund", "toman"),
  C("ime_fund_riton", "صندوق طلای ریتون", "fund", "toman"),
  C("ime_fund_roz_toranj", "صندوق طلای رز ترنج", "fund", "toman"),
  C("ime_fund_safron", "صندوق طلای زعفران", "fund", "toman"),
  C("ime_fund_zarfam", "صندوق طلای زرفام", "fund", "toman"),
  C("ime_fund_zargar", "صندوق طلای زرگر", "fund", "toman"),
  C("ime_fund_zarvan", "صندوق طلای زروان", "fund", "toman"),
  C("ime_fund_ghyrat", "صندوق طلای غیرت", "fund", "toman"),
  // نقره
  C("ime_fund_silver", "صندوق نقره سیم", "fund", "toman"),
  C("ime_fund_simin", "صندوق نقره سیمین", "fund", "toman"),
  C("ime_fund_noghran", "صندوق نقره نقران", "fund", "toman"),
  C("ime_fund_noghrin", "صندوق نقره نقرین", "fund", "toman"),
  C("ime_fund_noghrabi", "صندوق نقره نقرابی", "fund", "toman"),

  // ----------------------------- رمزارز -----------------------------
  C("crypto-bitcoin", "بیت‌کوین", "crypto", "usd"),
  C("crypto-bitcoin-irr", "بیت‌کوین (تومان)", "crypto", "toman"),
  C("crypto-ethereum", "اتریوم", "crypto", "usd"),
  C("crypto-ethereum-irr", "اتریوم (تومان)", "crypto", "toman"),
  C("crypto-tether", "تتر", "crypto", "usd"),
  C("crypto-tether-irr", "تتر (تومان)", "crypto", "toman"),
  C("crypto-binance-coin", "بایننس کوین", "crypto", "usd"),
  C("crypto-ripple", "ریپل (XRP)", "crypto", "usd"),
  C("crypto-cardano", "کاردانو", "crypto", "usd"),
  C("crypto-solana", "سولانا", "crypto", "usd"),
  C("crypto-dogecoin", "دوج‌کوین", "crypto", "usd"),
  C("crypto-tron", "ترون", "crypto", "usd"),
  C("crypto-polkadot", "پولکادات", "crypto", "usd"),
  C("crypto-litecoin", "لایت‌کوین", "crypto", "usd"),
  C("crypto-shiba-inu", "شیبا اینو", "crypto", "usd"),
  C("crypto-toncoin", "تون‌کوین", "crypto", "usd"),
  C("crypto-avalanche", "آوالانچ", "crypto", "usd"),
  C("crypto-monero", "مونرو", "crypto", "usd"),
  C("crypto-stellar", "استلار", "crypto", "usd"),
  C("crypto-chainlink", "چین‌لینک", "crypto", "usd"),
  C("crypto-bitcoin-cash", "بیت‌کوین کش", "crypto", "usd"),
  C("crypto-usd-coin", "یو‌اس‌دی کوین", "crypto", "usd"),
  C("crypto-paxg_gold", "پکس گلد", "crypto", "usd"),

  // ------------------------ بازارهای جهانی ------------------------
  C("oil", "نفت خام WTI", "global", "usd"),
  C("oil_brent", "نفت برنت", "global", "usd"),
  C("oil_opec", "سبد نفتی اوپک", "global", "usd"),
  C("copper", "مس", "global", "usd"),
  C("aluminium", "آلومینیوم", "global", "usd"),
  C("zinc", "روی", "global", "usd"),
  C("nickel", "نیکل", "global", "usd"),
  C("s_p_500_us", "شاخص S&P 500", "global", "point"),
  C("dow_jones_us", "شاخص داو جونز", "global", "point"),
  C("nasdaq_us", "شاخص نزدک", "global", "point"),
  C("bourse", "شاخص کل بورس تهران", "global", "point"),
  C("bourse_nikkei-225", "شاخص نیکی ۲۲۵", "global", "point"),
];

const BY_SYMBOL = new Map(TGJU_CATALOG.map((s) => [s.symbol, s]));

export function findSymbol(symbol: string): TgjuSymbolMeta | undefined {
  return BY_SYMBOL.get(symbol);
}

/**
 * واحد یک نماد. اگر نماد در کاتالوگ نباشه (ادمین دستی یک نماد جدید وارد کرده)
 * محتاطانه "toman" برمی‌گردونه، چون اکثر قریب‌به‌اتفاق نمادهای tgju ریالی‌اند.
 * ادمین می‌تونه واحد رو موقع ساخت دارایی صریحاً انتخاب کنه (Asset.priceUnit).
 */
export function unitForSymbol(symbol: string | null | undefined): MarketUnit {
  if (!symbol) return "toman";
  return BY_SYMBOL.get(symbol)?.unit ?? "toman";
}

export function labelForSymbol(symbol: string): string {
  return BY_SYMBOL.get(symbol)?.label ?? symbol;
}

/**
 * تبدیل عدد خام tgju به عددی که در دیتابیس ذخیره می‌شه.
 * فقط نمادهای ریالی تقسیم بر ۱۰ می‌شن؛ دلاری و شاخصی دست‌نخورده می‌مونن.
 */
export function toStoredPrice(raw: number, unit: MarketUnit): number {
  return unit === "toman" ? raw / 10 : raw;
}

/** "1,889,900,000" یا "\t8520000" → 1889900000 (بعضی مقادیر tgju فاصله/تب دارن) */
export function parseTgjuNumber(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[,\s‌]/g, "").replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
