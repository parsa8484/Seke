import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * دارایی‌های کاربر — روی خود دستگاه، و تنها نسخه‌ای که وجود دارد.
 *
 * چرا اینجا و نه روی سرور: تعداد سکه و قیمت خریدِ هر نفر داده‌ی مالیِ شخصی
 * است و دلیلی ندارد جایی جز گوشی خودش باشد. سرور فقط احراز هویت و قیمت بازار
 * می‌دهد؛ جدول `holdings` از دیتابیس حذف شده و پنل ادمین هم پرتفوی کسی را
 * نشان نمی‌دهد.
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

const storeKey = (userId: string) => `${STORE_PREFIX}${userId}`;

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

/**
 * دارایی‌های کاربر.
 *
 * تا قبل از این، اینجا مهاجرتِ یک‌باره از سرور هم انجام می‌شد؛ حالا که جدول
 * سمت سرور حذف شده چیزی برای آوردن نمانده و فقط از دیسک خوانده می‌شود.
 */
export async function loadHoldings(userId: string): Promise<LocalHoldings> {
  return readLocalHoldings(userId);
}
