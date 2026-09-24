import { PrismaClient } from "@prisma/client";
import fs from "fs";
import os from "os";
import path from "path";
import { config } from "../src/config";
import { RESTORE_FILE } from "../src/services/restoreStore";

// ساختنِ فایل بازیابی (restore/holdings.json) از نسخه‌ی پشتیبانِ قبل از حذف
// جدول holdings. اپ همین فایل را از راه /api/restore می‌گیرد.
//
// استفاده: npx tsx scripts/export-restore-holdings.ts prisma/dev.db.before-drop
//
// فایل پشتیبان را دست نمی‌زند (روی کپی موقت SELECT می‌زند). اگر فایل بازیابی
// از قبل هست چیزی را بازنویسی نمی‌کند، مگر با --force: بعد از اینکه بعضی کاربرها
// گرفتند و ورودیشان پاک شد، اجرای دوباره‌ی بی‌خبر ورودیِ آن‌ها را برمی‌گرداند.
//
// خروجی عمداً ASCII و بدون مقدارِ دارایی است: کنسول RDP فارسی را به `?` تبدیل
// می‌کند و اعداد مالیِ کاربران نباید روی صفحه بمانند.
const args = process.argv.slice(2);
const force = args.includes("--force");
const [backupArg] = args.filter((a) => !a.startsWith("--"));
if (!backupArg) {
  console.error(
    "Usage: npx tsx scripts/export-restore-holdings.ts <backup-file> [--force]"
  );
  process.exit(1);
}
const backupPath = path.resolve(backupArg);
if (!fs.existsSync(backupPath)) {
  console.error(`File not found: ${backupPath}`);
  process.exit(1);
}
if (fs.existsSync(RESTORE_FILE) && !force) {
  console.error(
    `${RESTORE_FILE} already exists. Some users may already have restored and had their entry removed; re-running would bring those entries back. Use --force only if that is what you want.`
  );
  process.exit(1);
}

const copyPath = path.join(os.tmpdir(), `sekeh-backup-read-${Date.now()}.db`);
fs.copyFileSync(backupPath, copyPath);
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${copyPath.replace(/\\/g, "/")}` } },
});

interface Row {
  userId: string;
  email: string;
  assetKey: string;
  quantity: number;
  avgBuyPrice: number | null;
  updatedAt: string | null;
}

/**
 * Prisma روی SQLite تاریخ را عدد (میلی‌ثانیه) می‌نویسد. ستون را در SQL به متن
 * تبدیل می‌کنیم تا تبدیلِ خودکارِ DATETIME در درایور دخالت نکند (خطای خام و بی‌پیامِ
 * P2010 می‌دهد)، و اینجا هر دو شکل را می‌خوانیم.
 */
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = /^\d+$/.test(value) ? new Date(Number(value)) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

(async () => {
  // خام است چون مدل Holding دیگر در schema نیست، ولی جدولش در پشتیبان هست
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT h."userId" AS userId, u.email AS email, a.key AS assetKey,
           h.quantity AS quantity, h."avgBuyPrice" AS avgBuyPrice,
           CAST(h."updatedAt" AS TEXT) AS updatedAt
    FROM holdings h
    JOIN users u ON u.id = h."userId"
    JOIN assets a ON a.id = h."assetId"
    WHERE h.quantity > 0 OR h."avgBuyPrice" > 0
    ORDER BY u.email, a.category, a."sortOrder"
  `;

  if (rows.length === 0) {
    console.log("No holdings in this backup; nothing to write.");
    return;
  }

  const out: Record<
    string,
    {
      email: string;
      items: { assetKey: string; quantity: number; avgBuyPrice: number | null }[];
    }
  > = {};
  const lastSaved: Record<string, Date | null> = {};

  for (const r of rows) {
    const entry = (out[r.userId] ??= { email: r.email, items: [] });
    entry.items.push({
      assetKey: r.assetKey,
      quantity: Number(r.quantity) || 0,
      // صفر یعنی «مجانی گرفتم»، که غلط است؛ ثبت‌نشده null است — همان قاعده‌ی اپ
      avgBuyPrice: Number(r.avgBuyPrice) > 0 ? Number(r.avgBuyPrice) : null,
    });
    const at = toDate(r.updatedAt);
    const prev = lastSaved[r.userId];
    if (at && (!prev || at > prev)) lastSaved[r.userId] = at;
  }

  fs.mkdirSync(config.restoreDir, { recursive: true });
  fs.writeFileSync(RESTORE_FILE, JSON.stringify(out, null, 2), "utf8");

  console.log(`Wrote ${RESTORE_FILE}`);
  for (const [userId, entry] of Object.entries(out)) {
    const at = lastSaved[userId];
    console.log(
      `  ${entry.email}: ${entry.items.length} rows, last saved on server ${
        at ? at.toISOString() : "unknown"
      }`
    );
  }
  console.log(`${Object.keys(out).length} users.`);
})()
  .catch((err) => {
    console.error("Failed to export:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    fs.rmSync(copyPath, { force: true });
  });
