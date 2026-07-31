import axios from "axios";
import { prisma } from "../db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
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

function formatToman(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/**
 * هشدارهای فعالِ مربوط به دارایی‌هایی که قیمتشان تازه عوض شده را بررسی می‌کند
 * و برای هرکدام که به هدف رسیده نوتیفیکیشن می‌فرستد.
 *
 * هشدار بعد از شلیک غیرفعال می‌شود (isActive=false) تا در هر رفرش بعدی
 * دوباره نوتیف تکراری نفرستد؛ کاربر می‌تواند از داخل اپ دوباره فعالش کند.
 */
export async function evaluatePriceAlerts(
  changed: { assetId: string; price: number }[]
): Promise<{ triggered: number }> {
  if (changed.length === 0) return { triggered: 0 };

  const priceByAsset = new Map(changed.map((c) => [c.assetId, c.price]));

  const alerts = await prisma.priceAlert.findMany({
    where: { isActive: true, assetId: { in: [...priceByAsset.keys()] } },
    include: { asset: { select: { label: true, unit: true, key: true } } },
  });
  if (alerts.length === 0) return { triggered: 0 };

  const hit = alerts.filter((a) => {
    const price = priceByAsset.get(a.assetId);
    if (price === undefined) return false;
    return a.direction === "below"
      ? price <= a.targetPrice
      : price >= a.targetPrice;
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
    const price = priceByAsset.get(alert.assetId)!;
    const arrow = alert.direction === "below" ? "📉" : "📈";
    const verb = alert.direction === "below" ? "پایین‌تر از" : "به";
    const body = `${alert.asset.label} ${verb} ${formatToman(
      alert.targetPrice
    )} تومان رسید — قیمت فعلی: ${formatToman(price)} تومان`;

    for (const token of tokensByUser.get(alert.userId) ?? []) {
      messages.push({
        to: token,
        title: `${arrow} هشدار قیمت`,
        body,
        sound: "default",
        priority: "high",
        data: { assetKey: alert.asset.key, price, alertId: alert.id },
      });
    }
  }

  await prisma.priceAlert.updateMany({
    where: { id: { in: hit.map((a) => a.id) } },
    data: { isActive: false, triggeredAt: new Date() },
  });
  // triggeredPrice برای هرکدام جداست، پس تک‌تک ثبت می‌شود
  await prisma.$transaction(
    hit.map((a) =>
      prisma.priceAlert.update({
        where: { id: a.id },
        data: { triggeredPrice: priceByAsset.get(a.assetId)! },
      })
    )
  );

  await sendExpoPush(messages);
  console.log(`[alerts] ${hit.length} هشدار شلیک شد، ${messages.length} پوش`);
  return { triggered: hit.length };
}
