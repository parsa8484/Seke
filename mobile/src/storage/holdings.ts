import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchServerHoldings } from "../api/holdings";

/**
 * دارایی‌های کاربر — روی خود دستگاه.
 *
 * چرا اینجا و نه روی سرور: تعداد سکه و قیمت خریدِ هر نفر داده‌ی مالیِ شخصی
 * است و دلیلی ندارد جایی جز گوشی خودش باشد. سرور فقط احراز هویت و قیمت بازار
 * را می‌دهد و هیچ‌وقت این عددها را نمی‌بیند.
 *
 * نتیجه‌ی مستقیمش: بین دستگاه‌ها سینک نمی‌شود و پاک‌کردن اپ یعنی پاک‌شدن
 * داده. این تصمیمِ آگاهانه است، نه باگ.
 */

export interface LocalHolding {
  quantity: number;
  /** null یعنی ثبت نشده — صفر یعنی «مجانی گرفتم» که غلط است و سود را خراب می‌کند */
  avgBuyPrice: number | null;
}

export type LocalHoldings = Record<string, LocalHolding>;

const STORE_PREFIX = "sekeh_holdings_v1:";
const MIGRATED_PREFIX = "sekeh_holdings_migrated_v1:";
/**
 * کلید پیش‌نویسِ نسخه‌های قبلی. آن موقع فقط بافرِ «هنوز روی سرور ذخیره نشده»
 * بود؛ حالا باید موقع مهاجرت خوانده شود وگرنه چیزی که کاربر همان دقایق آخر
 * تایپ کرده بود از بین می‌رود.
 */
const LEGACY_DRAFT_PREFIX = "sekeh_holdings_draft_v1:";

const storeKey = (userId: string) => `${STORE_PREFIX}${userId}`;
const migratedKey = (userId: string) => `${MIGRATED_PREFIX}${userId}`;
const legacyDraftKey = (userId: string) => `${LEGACY_DRAFT_PREFIX}${userId}`;

/** عددِ ورودی را به چیزی که ارزش ذخیره کردن دارد تبدیل می‌کند */
function sanitize(holding: Partial<LocalHolding>): LocalHolding | null {
  const quantity = Number(holding.quantity) || 0;
  const rawBuy = Number(holding.avgBuyPrice) || 0;
  const avgBuyPrice = rawBuy > 0 ? rawBuy : null;
  if (quantity <= 0 && avgBuyPrice === null) return null;
  return { quantity: quantity > 0 ? quantity : 0, avgBuyPrice };
}

function normalize(raw: unknown): LocalHoldings {
  if (!raw || typeof raw !== "object") return {};
  const out: LocalHoldings = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const clean = sanitize(value as Partial<LocalHolding>);
    if (clean) out[key] = clean;
  }
  return out;
}

export async function readLocalHoldings(userId: string): Promise<LocalHoldings> {
  try {
    const raw = await AsyncStorage.getItem(storeKey(userId));
    return raw ? normalize(JSON.parse(raw)) : {};
  } catch {
    // حافظه‌ی خراب نباید جلوی بالا آمدن داشبورد را بگیرد
    return {};
  }
}

export async function writeLocalHoldings(
  userId: string,
  holdings: LocalHoldings
): Promise<void> {
  const clean: LocalHoldings = {};
  for (const [key, value] of Object.entries(holdings)) {
    const sane = sanitize(value);
    if (sane) clean[key] = sane;
  }
  try {
    await AsyncStorage.setItem(storeKey(userId), JSON.stringify(clean));
  } catch {
    // جایی برای نوشتن نیست؛ چیزی که روی صفحه است دست‌کم تا بسته شدن اپ می‌ماند
  }
}

/** پیش‌نویسِ نسخه‌ی قبلی: {quantities: {key: "12"}, buyPrices: {key: "…"}} */
async function readLegacyDraft(userId: string): Promise<LocalHoldings> {
  try {
    const raw = await AsyncStorage.getItem(legacyDraftKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      quantities?: Record<string, string>;
      buyPrices?: Record<string, string>;
    };
    const keys = new Set([
      ...Object.keys(parsed?.quantities ?? {}),
      ...Object.keys(parsed?.buyPrices ?? {}),
    ]);
    const out: LocalHoldings = {};
    for (const key of keys) {
      const clean = sanitize({
        quantity: Number(parsed?.quantities?.[key]) || 0,
        avgBuyPrice: Number(parsed?.buyPrices?.[key]) || 0,
      });
      if (clean) out[key] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * مهاجرتِ یک‌باره‌ی دارایی‌های قبلی به گوشی.
 *
 * کاربرهای فعلی تعدادهایشان را روی سرور دارند و بعضی‌شان یک پیش‌نویس محلیِ
 * هنوز-ارسال-نشده. هر دو باید بدون از دست رفتن به حافظه‌ی دستگاه منتقل شوند.
 *
 * چهار قانون که با هم داده را حفظ می‌کنند:
 *  ۱. تا وقتی یک‌بار به سرور نرسیم، هر بار دوباره تلاش می‌شود. پس اگر کاربر
 *     اولین بار آفلاین باشد داده‌اش از دست نمی‌رود.
 *  ۲. چیزی که همین حالا روی گوشی هست هیچ‌وقت بازنویسی نمی‌شود — فقط کلیدهای
 *     غایب پر می‌شوند. وگرنه سناریوی «آفلاین بود، عددی تایپ کرد، بعد آنلاین
 *     شد» مقدار تازه را با مقدار کهنه‌ی سرور عوض می‌کرد.
 *  ۳. پیش‌نویسِ قدیمی بر مقدار سرور اولویت دارد، چون دقیقاً یعنی «تایپ شده
 *     بود ولی هنوز به سرور نرسیده بود» — و مستقل از اینکه سرور جواب داده یا
 *     نه منتقل می‌شود، چون خودش داده‌ی همین دستگاه است.
 *  ۴. پاسخ ۴۰۴ یعنی اندپوینت از سرور حذف شده؛ دیگر چیزی برای آوردن نیست و
 *     تلاش‌های بعدی بی‌فایده‌اند.
 */
export async function migrateServerHoldings(userId: string): Promise<void> {
  try {
    if (await AsyncStorage.getItem(migratedKey(userId))) return;
  } catch {
    return;
  }

  const [current, draft] = await Promise.all([
    readLocalHoldings(userId),
    readLegacyDraft(userId),
  ]);

  const fromServer: LocalHoldings = {};
  let serverAnswered = true;

  try {
    const summary = await fetchServerHoldings();
    for (const item of summary.items) {
      const clean = sanitize({
        quantity: item.quantity,
        avgBuyPrice: item.avgBuyPrice ?? 0,
      });
      if (clean) fromServer[item.assetKey] = clean;
    }
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    serverAnswered = status === 404;
  }

  const merged: LocalHoldings = { ...fromServer, ...draft, ...current };
  if (Object.keys(merged).length > 0) {
    await writeLocalHoldings(userId, merged);
  }

  // اگر سرور جواب نداد (قطعی شبکه)، نه علامت می‌زنیم نه پیش‌نویس را پاک
  // می‌کنیم؛ دفعه‌ی بعد دوباره سراغش می‌رویم.
  if (!serverAnswered) return;

  try {
    await AsyncStorage.setItem(migratedKey(userId), new Date().toISOString());
    await AsyncStorage.removeItem(legacyDraftKey(userId));
  } catch {
    // اگر علامت ثبت نشد، دفعه‌ی بعد دوباره مهاجرت می‌شود — که بی‌ضرر است،
    // چون مقادیر فعلیِ گوشی برنده‌اند.
  }
}

/** دارایی‌های کاربر، بعد از اطمینان از انجام مهاجرت */
export async function loadHoldings(userId: string): Promise<LocalHoldings> {
  await migrateServerHoldings(userId);
  return readLocalHoldings(userId);
}
