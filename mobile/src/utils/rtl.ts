import { I18nManager } from "react-native";
import * as Updates from "expo-updates";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * چیدمان کل اپ دستی راست‌چین شده (row-reverse + textAlign: "right") و موتور
 * چیدمان LTR فرض شده. روی گوشی‌ای که زبانش فارسی است اندروید خودش RTL را
 * روشن می‌کند و Yoga همه‌چیز را آینه می‌کند — یعنی همان row-reverse ها برعکس
 * (چپ‌چین) رندر می‌شوند و اپ به‌هم می‌ریزد. پس RTLِ سیستمی را خاموش می‌کنیم تا
 * روی هر زبانی دقیقاً مثل گوشی انگلیسی دربیاید.
 */

const RELOAD_GUARD_KEY = "sekeh_ltr_reload_attempted";

// وضعیت لحظه‌ی بالا آمدن باندل؛ بعد از allowRTL دیگر عوض نمی‌شود چون
// isRTL یک constant است که موقع ساخت پل نیتیو خوانده شده.
const startedRTL = I18nManager.isRTL;

// در سطح ماژول اجرا می‌شود تا قبل از اولین رندر ثبت شود. این‌ها فقط تنظیم را
// در نیتیو ذخیره می‌کنند؛ اعمالشان روی چیدمان نیازمند ری‌لود است.
try {
  I18nManager.allowRTL(false);
  if (startedRTL) {
    I18nManager.forceRTL(false);
  }
} catch {
  // روی وب/محیط‌هایی که ماژول نیتیو ندارند بی‌سروصدا رد شود
}

/**
 * اگر اپ در حالت RTL بالا آمده، یک‌بار ری‌لود می‌کند تا تنظیم بالا اعمال شود.
 * خروجی true یعنی ری‌لود در جریان است و ادامه‌ی کار (مثل چک آپدیت) بی‌معناست.
 *
 * محافظ حلقه: اگر بعد از یک ری‌لود باز هم RTL بود، دیگر ری‌لود نمی‌کند تا اپ
 * در بوت‌لوپ نیفتد. با اولین اجرای سالم، فلگ پاک می‌شود.
 */
export async function ensureLtrLayout(): Promise<boolean> {
  if (!startedRTL) {
    try {
      await AsyncStorage.removeItem(RELOAD_GUARD_KEY);
    } catch {
      // پاک نشدن فلگ فقط یعنی دفعه‌ی بعد یک ری‌لود کمتر — خطا نیست
    }
    return false;
  }

  try {
    if (await AsyncStorage.getItem(RELOAD_GUARD_KEY)) return false;
    await AsyncStorage.setItem(RELOAD_GUARD_KEY, "1");
    await Updates.reloadAsync();
    return true;
  } catch {
    // Expo Go / حالت توسعه: reloadAsync در دسترس نیست
    return false;
  }
}
