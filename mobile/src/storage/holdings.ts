import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchServerHoldings, wipeServerHoldings } from "../api/holdings";

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
/** لیست نمادهایی که باید از سرور خالی شوند؛ تا موفق نشود پاک نمی‌شود */
const WIPE_PENDING_PREFIX = "sekeh_holdings_wipe_pending_v1:";
/** نسخه‌ی سرور خالی شده و دیگر کاری با آن نداریم */
const WIPED_PREFIX = "sekeh_holdings_wiped_v1:";
/**
 * کلید پیش‌نویسِ نسخه‌های قبلی. آن موقع فقط بافرِ «هنوز روی سرور ذخیره نشده»
 * بود؛ حالا باید موقع مهاجرت خوانده شود وگرنه چیزی که کاربر همان دقایق آخر
 * تایپ کرده بود از بین می‌رود.
 */
const LEGACY_DRAFT_PREFIX = "sekeh_holdings_draft_v1:";

const storeKey = (userId: string) => `${STORE_PREFIX}${userId}`;
const migratedKey = (userId: string) => `${MIGRATED_PREFIX}${userId}`;
const wipePendingKey = (userId: string) => `${WIPE_PENDING_PREFIX}${userId}`;
const wipedKey = (userId: string) => `${WIPED_PREFIX}${userId}`;
const legacyDraftKey = (userId: string) => `${LEGACY_DRAFT_PREFIX}${userId}`;

async function readFlag(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeFlag(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // اگر علامت ننشست، دفعه‌ی بعد همان کار تکرار می‌شود — همه‌ی مرحله‌ها
    // عمداً idempotent هستند.
  }
}

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

/** true یعنی واقعاً روی دیسک نشست */
export async function writeLocalHoldings(
  userId: string,
  holdings: LocalHoldings
): Promise<boolean> {
  const clean: LocalHoldings = {};
  for (const [key, value] of Object.entries(holdings)) {
    const sane = sanitize(value);
    if (sane) clean[key] = sane;
  }
  try {
    await AsyncStorage.setItem(storeKey(userId), JSON.stringify(clean));
    return true;
  } catch {
    // جایی برای نوشتن نیست؛ چیزی که روی صفحه است دست‌کم تا بسته شدن اپ می‌ماند
    return false;
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
 * آیا هرچه قرار بود ذخیره شود واقعاً روی دیسک هست؟
 * فقط برای قبل از خالی کردن نسخه‌ی سرور — بعدش دیگر راه برگشتی نیست.
 */
async function verifyStored(
  userId: string,
  expected: LocalHoldings
): Promise<boolean> {
  const stored = await readLocalHoldings(userId);
  return Object.entries(expected).every(([key, value]) => {
    const sane = sanitize(value);
    if (!sane) return true;
    const got = stored[key];
    return (
      got !== undefined &&
      got.quantity === sane.quantity &&
      got.avgBuyPrice === sane.avgBuyPrice
    );
  });
}

/** نمادهایی که سرور برای این کاربر داده‌ی واقعی دارد */
function keysWithData(
  items: { assetKey: string; quantity: number; avgBuyPrice: number | null }[]
) {
  return items
    .filter((i) => i.quantity > 0 || (i.avgBuyPrice ?? 0) > 0)
    .map((i) => i.assetKey);
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
async function pullFromServer(userId: string): Promise<void> {
  if (await readFlag(migratedKey(userId))) return;

  const [current, draft] = await Promise.all([
    readLocalHoldings(userId),
    readLegacyDraft(userId),
  ]);

  const fromServer: LocalHoldings = {};
  let serverKeys: string[] = [];
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
    serverKeys = keysWithData(summary.items);
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    serverAnswered = status === 404;
  }

  const merged: LocalHoldings = { ...fromServer, ...draft, ...current };
  const written =
    Object.keys(merged).length === 0
      ? true
      : (await writeLocalHoldings(userId, merged)) &&
        // دوباره از دیسک می‌خوانیم و تطبیق می‌دهیم. این تنها ضمانتی است که
        // قبل از خالی کردن نسخه‌ی سرور داریم، پس به «خطا نداد» اکتفا نمی‌کنیم.
        (await verifyStored(userId, merged));

  // اگر سرور جواب نداد (قطعی شبکه) یا نوشتن روی دیسک شکست خورد، نه علامت
  // می‌زنیم نه پیش‌نویس را پاک می‌کنیم؛ دفعه‌ی بعد دوباره سراغش می‌رویم.
  if (!serverAnswered || !written) return;

  // فهرست چیزی که باید از سرور خالی شود همین‌جا ثبت می‌شود — فقط همین لحظه
  // مطمئنیم دقیقاً چه چیزی سالم روی گوشی نوشته شد.
  if (serverKeys.length > 0) {
    await writeFlag(wipePendingKey(userId), JSON.stringify(serverKeys));
  }
  await writeFlag(migratedKey(userId), new Date().toISOString());
  try {
    await AsyncStorage.removeItem(legacyDraftKey(userId));
  } catch {
    // بی‌اهمیت: دفعه‌ی بعد هم همان مقدار را می‌دهد و مقدار گوشی برنده است
  }
}

/**
 * خالی کردن نسخه‌ی سرور، بعد از اینکه داده سالم روی گوشی نشست.
 *
 * تا وقتی موفق نشود هر بار تکرار می‌شود، چون هدف این است که داده‌ی سمت سرور
 * واقعاً به صفر برسد — همان عددی که نشان می‌دهد همه‌ی نصب‌ها مهاجرت کرده‌اند
 * و می‌شود جدول را حذف کرد.
 *
 * هیچ‌وقت چیزی را از سرور پاک نمی‌کند که روی گوشی نباشد.
 */
async function clearServerCopy(userId: string): Promise<void> {
  if (await readFlag(wipedKey(userId))) return;
  if (!(await readFlag(migratedKey(userId)))) return;

  const local = await readLocalHoldings(userId);
  let keys: string[] | null = null;

  const pending = await readFlag(wipePendingKey(userId));
  if (pending) {
    try {
      const parsed = JSON.parse(pending) as string[];
      if (Array.isArray(parsed)) keys = parsed;
    } catch {
      keys = null;
    }
  }

  if (keys === null) {
    // کسانی که با نسخه‌ی قبلیِ همین به‌روزرسانی مهاجرت کرده‌اند و فهرستی
    // ذخیره نشده: از خود سرور می‌پرسیم چه چیزی مانده.
    try {
      const summary = await fetchServerHoldings();
      keys = keysWithData(summary.items);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) await writeFlag(wipedKey(userId), "gone");
      return;
    }
    // محافظ: چیزی که روی گوشی نیست از سرور پاک نمی‌شود
    const missing = keys.filter((key) => !(key in local));
    if (missing.length > 0) return;
  }

  if (keys.length > 0) {
    try {
      await wipeServerHoldings(keys);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) return; // شبکه نبود؛ دفعه‌ی بعد
    }
  }

  await writeFlag(wipedKey(userId), new Date().toISOString());
  try {
    await AsyncStorage.removeItem(wipePendingKey(userId));
  } catch {
    // مهم نیست؛ فلگ wiped جلوی تکرار را می‌گیرد
  }
}

/** مهاجرت + پاک‌سازی نسخه‌ی سرور. هر دو idempotent و بی‌صدا. */
export async function migrateServerHoldings(userId: string): Promise<void> {
  await pullFromServer(userId);
  await clearServerCopy(userId);
}

/** دارایی‌های کاربر، بعد از اطمینان از انجام مهاجرت */
export async function loadHoldings(userId: string): Promise<LocalHoldings> {
  await migrateServerHoldings(userId);
  return readLocalHoldings(userId);
}
