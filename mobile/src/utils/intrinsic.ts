import { MarketItem } from "../api/types";

/**
 * قیمت «محاسباتی» (ذاتی) طلا و نقره از روی انس جهانی و دلار، و حبابِ قیمت بازار
 * نسبت به آن.
 *
 * پایه‌ی هر دو فرمول یکی است: قیمت هر گرم = (انس × دلار ÷ گرم‌های یک انس) × عیار.
 *  - طلای ۱۸ عیار: ۰٫۷۵ ÷ ۳۱٫۱۰۳۵ = ۰٫۰۲۴۱۱۳۰۴۱۹ → ضریب ثابت در انس و دلار
 *  - نقره‌ی ۹۹۹: انس × دلار ÷ ۳۱٫۱۰۳۵ (عیار ~۱)
 *
 * انس‌ها در tgju دلاری‌اند و دلار تومانی، پس خروجی تومان بر گرم است. اگر یکی از
 * سه قیمت نبود (یا صفر بود) خروجی null است تا به‌جای عددِ غلط چیزی نشان ندهیم.
 */

/**
 * نماد دلار در فهرست بازار `price_dollar_rl` است (تومانی) — نه `currency_usd`
 * که کلیدِ دارایی در پرتفوی است و در این فهرست وجود ندارد. بقیه‌ی گزینه‌ها
 * فقط پشتیبان‌اند اگر کاتالوگ عوض شود.
 */
const USD_SYMBOLS = ["price_dollar_rl", "price_dollar_ex", "currency_usd"];
const OUNCE_GRAMS = 31.1035;
const GOLD_18_FACTOR = 0.0241130419; // ۰٫۷۵ / ۳۱٫۱۰۳۵

type IntrinsicSpec = {
  /** نماد انس جهانیِ متناظر در tgju (دلاری) */
  ounceSymbol: string;
  ounceLabel: string;
  /** ضریب تبدیل «انس × دلار» به تومانِ هر گرم */
  gramFactor: number;
};

const SPECS: Record<string, IntrinsicSpec> = {
  geram18: {
    ounceSymbol: "ons",
    ounceLabel: "انس جهانی طلا",
    gramFactor: GOLD_18_FACTOR,
  },
  silver_999: {
    ounceSymbol: "silver",
    ounceLabel: "انس جهانی نقره",
    gramFactor: 1 / OUNCE_GRAMS,
  },
};

export type IntrinsicPrice = {
  /** قیمت محاسباتی هر گرم، تومان */
  computed: number;
  /** قیمت بازار همان لحظه، تومان */
  market: number;
  /** اختلاف بازار با محاسباتی، تومان (مثبت = حباب) */
  bubble: number;
  bubblePercent: number;
  usd: number;
  ounce: number;
  ounceLabel: string;
};

export function hasIntrinsicPrice(symbol: string): boolean {
  return symbol in SPECS;
}

export function computeIntrinsic(
  symbol: string,
  items: MarketItem[] | undefined
): IntrinsicPrice | null {
  const spec = SPECS[symbol];
  if (!spec || !items) return null;

  const target = items.find((i) => i.symbol === symbol);
  // به ترتیب اولویتِ USD_SYMBOLS، نه به ترتیب چیدمان فهرست
  let usd: MarketItem | undefined;
  for (const candidate of USD_SYMBOLS) {
    usd = items.find(
      (i) => i.symbol === candidate && i.unit === "toman" && i.price > 0
    );
    if (usd) break;
  }
  const ounce = items.find((i) => i.symbol === spec.ounceSymbol);

  if (!target?.price || !usd?.price || !ounce?.price) return null;

  const computed = ounce.price * usd.price * spec.gramFactor;
  if (!Number.isFinite(computed) || computed <= 0) return null;

  const bubble = target.price - computed;
  return {
    computed,
    market: target.price,
    bubble,
    bubblePercent: (bubble / computed) * 100,
    usd: usd.price,
    ounce: ounce.price,
    ounceLabel: spec.ounceLabel,
  };
}

/** یک‌بار برای کل لیست، تا هر ردیف دوباره کل آرایه را نگردد */
export function buildIntrinsicMap(
  items: MarketItem[] | undefined
): Record<string, IntrinsicPrice> {
  const map: Record<string, IntrinsicPrice> = {};
  if (!items) return map;
  for (const symbol of Object.keys(SPECS)) {
    const value = computeIntrinsic(symbol, items);
    if (value) map[symbol] = value;
  }
  return map;
}
