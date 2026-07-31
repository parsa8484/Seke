import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { registerPushToken } from "../api/alerts";

// وقتی اپ باز است هم نوتیفیکیشن نمایش داده شود — هشدار قیمت وقتی ارزش داره
// که همون لحظه دیده بشه.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface PushRegistration {
  token: string | null;
  /** پیام فارسیِ قابل‌نمایش وقتی ثبت نشد */
  error: string | null;
}

/**
 * اجازه‌ی نوتیفیکیشن می‌گیرد، توکن پوش Expo را می‌سازد و روی سرور ثبت می‌کند.
 * روی شبیه‌ساز کار نمی‌کند (نیاز به دستگاه واقعی) و این حالت با پیام مشخص
 * برمی‌گردد نه با کرش.
 */
export async function registerForPushNotifications(): Promise<PushRegistration> {
  if (!Device.isDevice) {
    return {
      token: null,
      error: "نوتیفیکیشن فقط روی دستگاه واقعی کار می‌کند، نه شبیه‌ساز",
    };
  }

  if (Platform.OS === "android") {
    // بدون کانال، اندروید ۸ به بالا نوتیفیکیشن را بی‌صدا رد می‌کند
    await Notifications.setNotificationChannelAsync("price-alerts", {
      name: "هشدار قیمت",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#D4AF37",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return {
      token: null,
      error: "اجازه‌ی ارسال نوتیفیکیشن داده نشد. از تنظیمات گوشی فعالش کنید",
    };
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await registerPushToken(
      tokenResponse.data,
      Platform.OS === "ios" ? "ios" : "android"
    );
    return { token: tokenResponse.data, error: null };
  } catch (err) {
    return {
      token: null,
      error: `ثبت توکن نوتیفیکیشن ناموفق بود: ${(err as Error).message}`,
    };
  }
}
