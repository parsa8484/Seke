import "dotenv/config";
import path from "path";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",
  brsapiKey: process.env.BRSAPI_KEY ?? "",
  priceRefreshMinutes: Number(process.env.PRICE_REFRESH_MINUTES ?? 15),
  // پوشه‌ی فایل‌های APK که از /app سرو می‌شوند (بیرون از گیت نگه داشته می‌شود)
  downloadDir: path.resolve(
    process.env.DOWNLOAD_DIR ?? path.join(process.cwd(), "downloads")
  ),
  // پوشه‌ی فایل موقتِ بازیابی‌ی دارایی‌ها (بیرون از گیت) — restoreStore.ts
  restoreDir: path.resolve(
    process.env.RESTORE_DIR ?? path.join(process.cwd(), "restore")
  ),
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
