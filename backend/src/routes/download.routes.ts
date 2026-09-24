import { Router } from "express";
import fs from "fs";
import path from "path";
import { config } from "../config";

export const downloadRouter = Router();

type ApkFile = {
  name: string;
  size: number;
  mtime: number;
  version: string | null;
};

/** فایل‌های APK موجود در پوشه‌ی دانلود، جدیدترین اول */
function listApks(): ApkFile[] {
  let names: string[];
  try {
    names = fs.readdirSync(config.downloadDir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.toLowerCase().endsWith(".apk"))
    .map((name) => {
      const stat = fs.statSync(path.join(config.downloadDir, name));
      const match = name.match(/(\d+\.\d+(?:\.\d+)?)/);
      return {
        name,
        size: stat.size,
        mtime: stat.mtimeMs,
        version: match ? match[1] : null,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/** جلوگیری از path traversal: فقط نام فایل، بدون مسیر */
function resolveApk(requested: string): string | null {
  const base = path.basename(requested);
  if (!base.toLowerCase().endsWith(".apk")) return null;
  const full = path.join(config.downloadDir, base);
  if (!full.startsWith(path.resolve(config.downloadDir))) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}

function sendApk(res: import("express").Response, full: string) {
  const size = fs.statSync(full).size;
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Length", String(size));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(full)}"`
  );
  res.setHeader("Cache-Control", "public, max-age=300");
  fs.createReadStream(full).pipe(res);
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );
}

function page(latest: ApkFile | null): string {
  const body = latest
    ? `
      <a class="btn" href="/app/download">دانلود نسخه‌ی اندروید</a>
      <p class="meta">${
        latest.version ? `نسخه ${escapeHtml(latest.version)} · ` : ""
      }${formatMb(latest.size)} مگابایت</p>
      <ol class="steps">
        <li>روی دکمه‌ی بالا بزنید تا فایل دانلود شود.</li>
        <li>فایل دانلودشده را باز کنید.</li>
        <li>اگر پیام «نصب برنامه‌های ناشناس» آمد، اجازه‌ی نصب را برای مرورگر فعال کنید و برگردید.</li>
        <li>روی «نصب» بزنید.</li>
      </ol>
      <p class="note">این برنامه از فروشگاه نصب نمی‌شود، پس هشدار اندروید طبیعی است.</p>`
    : `<p class="meta">فعلاً نسخه‌ای برای دانلود قرار نگرفته است.</p>`;

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>دانلود دارایار</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px;
    background: #0B0F17; color: #E6EAF2;
    font-family: Vazirmatn, "Segoe UI", Tahoma, sans-serif;
  }
  .card {
    width: 100%; max-width: 420px; text-align: center;
    background: #131926; border: 1px solid #232C3D;
    border-radius: 20px; padding: 32px 24px;
  }
  h1 { margin: 0 0 4px; font-size: 26px; color: #D4AF37; }
  .sub { margin: 0 0 28px; font-size: 15px; color: #9AA5B8; }
  .btn {
    display: block; padding: 16px; border-radius: 14px;
    background: #D4AF37; color: #0B0F17; font-size: 18px;
    font-weight: 700; text-decoration: none;
  }
  .btn:active { opacity: .85; }
  .meta { margin: 12px 0 0; font-size: 14px; color: #9AA5B8; }
  .steps {
    margin: 28px 0 0; padding: 0 20px 0 0; text-align: right;
    font-size: 15px; line-height: 2; color: #C3CBDA;
  }
  .note { margin: 20px 0 0; font-size: 13px; color: #7C879B; line-height: 1.9; }
</style>
</head>
<body>
  <div class="card">
    <h1>دارایار</h1>
    <p class="sub">رهگیری سکه، طلا و صندوق‌های طلا</p>
    ${body}
  </div>
</body>
</html>`;
}

// صفحه‌ی دانلود؛ لینکی که به کاربران داده می‌شود
downloadRouter.get("/app", (_req, res) => {
  res.type("html").send(page(listApks()[0] ?? null));
});

// لینک ثابت جدیدترین نسخه — با انتشار نسخه‌ی بعدی تغییر نمی‌کند
downloadRouter.get("/app/download", (_req, res) => {
  const latest = listApks()[0];
  if (!latest) {
    res.status(404).type("html").send(page(null));
    return;
  }
  sendApk(res, path.join(config.downloadDir, latest.name));
});

// دانلود مستقیم یک فایل مشخص
downloadRouter.get("/download/:file", (req, res) => {
  const full = resolveApk(req.params.file);
  if (!full) {
    res.status(404).json({ error: "فایل پیدا نشد" });
    return;
  }
  sendApk(res, full);
});
