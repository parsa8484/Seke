// ذخیره‌ی یک فایل متنی جایی که کاربر واقعاً پیدایش کند.
//
// چرا expo-sharing استفاده نشده: آن یک ماژول نیتیو است و اضافه کردنش یعنی
// نسخه‌ی نصب‌شده‌ی اپ دیگر با OTA به‌روز نمی‌شود و باید eas build گرفت.
// expo-file-system از قبل در باندل هست (وابستگی خود expo)، پس این مسیر
// بدون بیلد جدید کار می‌کند.
//
// روی اندروید از Storage Access Framework استفاده می‌شود: کاربر پوشه را خودش
// انتخاب می‌کند و فایل همان‌جا ساخته می‌شود (بدون نیاز به مجوز حافظه، که در
// app.json عمداً بلاک شده تا Play Protect گیر ندهد).

import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system";

export type ExportResult =
  | { status: "saved"; location: string }
  | { status: "shared" }
  | { status: "cancelled" };

/** "content://…/tree/primary%3ADownload" → "Download" */
function folderNameFromUri(uri: string): string {
  try {
    const decoded = decodeURIComponent(uri);
    const afterColon = decoded.split(":").pop() ?? "";
    const name = afterColon.split("/").filter(Boolean).pop();
    return name || "پوشه‌ی انتخابی";
  } catch {
    return "پوشه‌ی انتخابی";
  }
}

/**
 * `baseName` باید بدون پسوند باشد — SAF خودش پسوند را از روی mimeType
 * اضافه می‌کند و اگر ".csv" را دستی بدهیم فایل "…csv.csv" می‌شود.
 */
export async function saveTextFile(
  baseName: string,
  mimeType: string,
  content: string
): Promise<ExportResult> {
  if (Platform.OS === "android") {
    try {
      const permission =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) return { status: "cancelled" };

      const uri = await FileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        baseName,
        mimeType
      );
      await FileSystem.writeAsStringAsync(uri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return { status: "saved", location: folderNameFromUri(permission.directoryUri) };
    } catch {
      // بعضی دستگاه‌ها/رام‌ها SAF ندارند یا انتخاب پوشه شکست می‌خورد —
      // به‌جای پیام خطا حداقل بگذار محتوا را به جایی بفرستد.
    }
  }

  await Share.share({ message: content, title: baseName });
  return { status: "shared" };
}
