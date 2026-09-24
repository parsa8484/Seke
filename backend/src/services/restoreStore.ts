import fs from "fs";
import path from "path";
import { config } from "../config";

/**
 * بازیابیِ موقتِ دارایی‌های چند کاربر که موقع مهاجرتِ ۲۰۲۶-۰۹-۲۴ به گوشی نرسیدند.
 *
 * دارایی‌ها الان فقط روی گوشی‌اند و سرور جدولی برایشان ندارد. این فایل یک
 * استثنای موقت است: داده‌ی همان چند نفر که از نسخه‌ی پشتیبان درآمده، تا اپ
 * هنگام ورودِ اول آن را بگیرد، روی گوشی بنویسد و بعد از تأیید، ورودی خودش را
 * از اینجا پاک کند. بعد از اینکه همه گرفتند (یا مهلت گذشت) این فایل، مسیرها و
 * کدِ اپ حذف می‌شوند — CLAUDE.md، بخش «بازیابی‌ی موقت».
 *
 * چرا فایل و نه جدول: بدون تغییر schema، پس نه migrate لازم است نه
 * `prisma generate` (که روی VPS ویندوزی تله‌ی EPERM دارد).
 */

export interface RestoreItem {
  assetKey: string;
  quantity: number;
  avgBuyPrice: number | null;
}

interface RestoreEntry {
  /** فقط برای اینکه کسی که فایل را باز می‌کند بفهمد ورودی مالِ کیست */
  email: string;
  items: RestoreItem[];
}

type RestoreFile = Record<string, RestoreEntry>;

export const RESTORE_FILE = path.join(config.restoreDir, "holdings.json");

/**
 * نبودنِ فایل یعنی چیزی برای بازیابی نیست؛ هر خطای دیگر (خراب بودن JSON،
 * دسترسی) پرتاب می‌شود. مهم است: اگر فایل خراب را «خالی» فرض کنیم و بعدش
 * چیزی بنویسیم، داده‌ی بقیه‌ی کاربران را با یک `{}` می‌سوزانیم.
 */
function readFile(): RestoreFile {
  let raw: string;
  try {
    raw = fs.readFileSync(RESTORE_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("restore file is not an object");
  }
  return parsed as RestoreFile;
}

/** اول فایل موقت، بعد rename — وسط نوشتن قطع شود فایل اصلی نیمه‌کاره نمی‌ماند */
function writeFile(data: RestoreFile) {
  fs.mkdirSync(config.restoreDir, { recursive: true });
  const tmp = `${RESTORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, RESTORE_FILE);
}

export function getRestoreItems(userId: string): RestoreItem[] {
  return readFile()[userId]?.items ?? [];
}

export type AckResult = "removed" | "nothing" | "mismatch";

/**
 * ورودیِ این کاربر را پاک می‌کند، ولی فقط اگر اپ تک‌تک نمادهای آن را روی گوشی
 * نوشته و تأیید کرده باشد. اگر چیزی در ورودی باشد که در `writtenKeys` نیست،
 * پاک نمی‌شود — همان قاعده‌ی «چیزی را که روی گوشی نیست از سرور نبر».
 *
 * همه‌ی مرحله‌ها همزمان (sync) هستند؛ بین خواندن و نوشتن هیچ await نیست، پس
 * دو درخواست هم‌زمان نمی‌توانند هم‌دیگر را بازنویسی کنند.
 */
export function ackRestore(userId: string, writtenKeys: string[]): AckResult {
  const all = readFile();
  const entry = all[userId];
  if (!entry) return "nothing";

  const written = new Set(writtenKeys);
  if (!entry.items.every((item) => written.has(item.assetKey))) return "mismatch";

  delete all[userId];
  writeFile(all);
  return "removed";
}

/** شناسه‌ی کاربرانی که هنوز چیزی برای بازیابی دارند — برای شمارشِ پنل ادمین */
export function pendingRestoreUserIds(): string[] {
  try {
    return Object.keys(readFile());
  } catch {
    return [];
  }
}
