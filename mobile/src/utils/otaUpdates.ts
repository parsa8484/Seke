import * as Updates from "expo-updates";

/**
 * آپدیت OTA. expo-updates به‌صورت پیش‌فرض آپدیت را در پس‌زمینه می‌گیرد و
 * دفعه‌ی *بعدِ* باز شدن اپ اعمال می‌کند؛ این یعنی کاربر یک اجرا با نسخه‌ی قدیمی
 * می‌بیند. این تابع موقع بالا آمدن اپ (قبل از اینکه کاربر کاری کند) آپدیت را
 * می‌گیرد و بلافاصله ری‌لود می‌کند تا همان اجرای اول به‌روز باشد.
 */
export async function fetchAndApplyUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;

  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;

    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return;

    await Updates.reloadAsync();
  } catch {
    // نبود شبکه یا خطای سرور آپدیت نباید جلوی بالا آمدن اپ را بگیرد
  }
}

/**
 * نسخه‌ی بی‌مزاحمت برای وقتی اپ از پس‌زمینه برمی‌گردد: فقط دانلود می‌کند و
 * ری‌لود نمی‌کند، چون کاربر وسط کار است. آپدیتِ دانلودشده خودش اجرای بعد اعمال می‌شود.
 */
export async function prefetchUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;

  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // بی‌صدا
  }
}
