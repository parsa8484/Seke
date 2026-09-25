import axios from "axios";
import { prisma } from "../db";
import { formatTomanFa } from "../utils/format";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * باید دقیقاً با کانالی که اپ می‌سازد یکی باشد
 * (mobile/src/services/notifications.ts → PRICE_ALERT_CHANNEL_ID).
 * بدون این فیلد، اندروید نوتیف را در کانال پیش‌فرضِ «متفرقه» نشان می‌دهد و
 * تنظیمات کانالِ ما (صدا، لرزش، اهمیت بالا، اسم فارسی) اصلاً اعمال نمی‌شود.
 */
const ANDROID_CHANNEL_ID = "price-alerts";

export type AlertDirection = "above" | "below";

export interface PriceChange {
  assetId: string;
  price: number;
  /** قیمت قبلیِ ثبت‌شده؛ null یعنی این اولین قیمتِ این دارایی است */
  previousPrice: number | null;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: string;
  data?: Record<string, unknown>;
}

/**
 * ارسال پوش از طریق سرویس رایگان Expo. اگر توکنی دیگر معتبر نباشد
 * (کاربر اپ را حذف کرده) از دیتابیس پاک می‌شود تا لیست تمیز بماند.
 */
async function sendExpoPush(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;

  // Expo هر درخواست را تا ۱۰۰ پیام قبول می‌کند
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const { data } = await axios.post(EXPO_PUSH_URL, chunk, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        timeout: 15000,
      });

      const tickets: any[] = Array.isArray(data?.data) ? data.data : [];
      const dead: string[] = [];
      tickets.forEach((ticket, idx) => {
        if (
          ticket?.status === "error" &&
          ticket?.details?.error === "DeviceNotRegistered"
        ) {
          dead.push(chunk[idx].to);
        }
      });
      if (dead.length > 0) {
        await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
        console.log(`[alerts] ${dead.length} توکن پوش منقضی حذف شد`);
      }
    } catch (err) {
      console.error("[alerts] ارسال پوش ناموفق:", (err as Error).message);
    }
  }
}

/**
 * آیا قیمت داده‌شده همین حالا شرط هشدار را برآورده می‌کند؟
 *
 * این «رسیدن به هدف» است، نه «رد کردنِ هدف» — برای بررسیِ لحظه‌ی ساختِ هشدار
 * به کار می‌رود تا کاربر هدفی نگذارد که از قبل محقق شده.
 */
export function isConditionMet(
  direction: string,
  targetPrice: number,
  price: number | null | undefined
): boolean {
  if (price === null || price === undefined) return false;
  return direction === "below" ? price <= targetPrice : price >= targetPrice;
}

/**
 * آیا قیمت در همین به‌روزرسانی از هدف *عبور* کرد؟
 *
 * چرا عبور و نه صرفاً «قیمت فعلی شرط را دارد»: با شرطِ ساده، هشداری که
 * هدفش از ابتدا محقق بوده (مثلاً کاربر عدد پیش‌فرضِ برابر با قیمت فعلی را
 * دست‌نخورده رها کرده) در اولین رفرش شلیک می‌شد و نوتیفِ «به فلان قیمت رسید»
 * برای اتفاقی می‌آمد که اصلاً نیفتاده بود. هشدار باید لحظه‌ی حرکتِ قیمت از
 * یک طرفِ هدف به طرف دیگر بزند.
 */
function hasCrossed(
  direction: string,
  targetPrice: number,
  price: number,
  previousPrice: number | null
): boolean {
  if (!isConditionMet(direction, targetPrice, price)) return false;
  // قیمت قبلی نداریم (دارایی تازه): همان شرط ساده تنها معیار ممکن است
  if (previousPrice === null) return true;
  return direction === "below"
    ? previousPrice > targetPrice
    : previousPrice < targetPrice;
}

/** پیام خطای فارسی برای وقتی هدفِ انتخاب‌شده همین حالا محقق است */
export function alreadyMetMessage(
  direction: string,
  currentPrice: number
): string {
  const side = direction === "below" ? "کوچک‌تر" : "بزرگ‌تر";
  const label = direction === "below" ? "پایین‌تر از" : "بالاتر از";
  return `قیمت فعلی ${formatTomanFa(
    currentPrice
  )} تومان است و همین حالا شرط «${label}» را برآورده می‌کند. برای اینکه هشدار معنی داشته باشد عددی ${side} از قیمت فعلی بگذارید.`;
}

/**
 * هشدارهای فعالِ مربوط به دارایی‌هایی که قیمتشان تازه عوض شده را بررسی می‌کند
 * و برای هرکدام که قیمت از هدفش عبور کرده نوتیفیکیشن می‌فرستد.
 *
 * هشدار بعد از شلیک غیرفعال می‌شود (isActive=false) تا در هر رفرش بعدی
 * دوباره نوتیف تکراری نفرستد؛ کاربر می‌تواند از داخل اپ دوباره فعالش کند.
 */
export async function evaluatePriceAlerts(
  changed: PriceChange[]
): Promise<{ triggered: number }> {
  if (changed.length === 0) return { triggered: 0 };

  const changeByAsset = new Map(changed.map((c) => [c.assetId, c]));

  const alerts = await prisma.priceAlert.findMany({
    where: {
      isActive: true,
      assetId: { in: [...changeByAsset.keys()] },
      // حسابِ غیرفعال‌شده توسط ادمین نباید نوتیف بگیرد
      user: { isActive: true },
    },
    include: { asset: { select: { label: true, unit: true, key: true } } },
  });
  if (alerts.length === 0) return { triggered: 0 };

  const hit = alerts.filter((a) => {
    const change = changeByAsset.get(a.assetId);
    if (!change) return false;
    return hasCrossed(
      a.direction,
      a.targetPrice,
      change.price,
      change.previousPrice
    );
  });
  if (hit.length === 0) return { triggered: 0 };

  const userIds = [...new Set(hit.map((a) => a.userId))];
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, token: true },
  });
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens) {
    tokensByUser.set(t.userId, [...(tokensByUser.get(t.userId) ?? []), t.token]);
  }

  const messages: ExpoMessage[] = [];
  for (const alert of hit) {
    const price = changeByAsset.get(alert.assetId)!.price;
    const arrow = alert.direction === "below" ? "📉" : "📈";
    const verb = alert.direction === "below" ? "پایین‌تر از" : "به";
    const body = `${alert.asset.label} ${verb} ${formatTomanFa(
      alert.targetPrice
    )} تومان رسید — قیمت فعلی: ${formatTomanFa(price)} تومان`;

    for (const token of tokensByUser.get(alert.userId) ?? []) {
      messages.push({
        to: token,
        title: `${arrow} هشدار قیمت`,
        body,
        sound: "default",
        priority: "high",
        channelId: ANDROID_CHANNEL_ID,
        data: { assetKey: alert.asset.key, price, alertId: alert.id },
      });
    }
  }

  // غیرفعال‌کردن و ثبتِ قیمتِ شلیک در یک رفت‌وبرگشت: triggeredPrice برای هر
  // هشدار جداست، پس updateMany به تنهایی جواب نمی‌دهد.
  await prisma.$transaction(
    hit.map((a) =>
      prisma.priceAlert.update({
        where: { id: a.id },
        data: {
          isActive: false,
          triggeredAt: new Date(),
          triggeredPrice: changeByAsset.get(a.assetId)!.price,
        },
      })
    )
  );

  await sendExpoPush(messages);
  console.log(`[alerts] ${hit.length} هشدار شلیک شد، ${messages.length} پوش`);
  return { triggered: hit.length };
}
