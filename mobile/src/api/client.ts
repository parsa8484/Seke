import axios from "axios";
import * as SecureStore from "expo-secure-store";

// آدرس بک‌اند: در توسعه از EXPO_PUBLIC_API_URL (فایل .env) خونده می‌شه.
// روی دستگاه واقعی/شبیه‌ساز نمی‌شه از "localhost" استفاده کرد، باید IP شبکه‌ی
// کامپیوتر یا دامنه‌ی سرور واقعی رو گذاشت - جزئیات در README.md پوشه‌ی mobile.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export const TOKEN_KEY = "sekeh_auth_token";

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * فقط رد واقعیِ سرور (توکن نامعتبر/منقضی، حساب غیرفعال، کاربر پیدا نشد) را
 * تشخیص می‌دهد. خطای شبکه یا قطعی موقت سرور را false برمی‌گرداند تا کد
 * صداکننده بتواند فرق بگذارد بین «واقعاً باید لاگ‌اوت کرد» و «فقط موقتاً به
 * سرور نرسیدیم» — قبلاً هر دو یکسان مدیریت می‌شدند و یک قطعی چندثانیه‌ای
 * اینترنت کاربر را کامل از حساب بیرون می‌انداخت.
 */
export function isAuthRejection(err: unknown): boolean {
  if (!axios.isAxiosError(err) || !err.response) return false;
  return [401, 403, 404].includes(err.response.status);
}

// پیام خطای فارسیِ خوانا از پاسخ سرور استخراج می‌کنه (یا یه پیام عمومی)
export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const serverMessage = (err.response?.data as { error?: string } | undefined)
      ?.error;
    if (serverMessage) return serverMessage;
    if (err.code === "ECONNABORTED") return "ارتباط با سرور برقرار نشد (timeout)";
    if (!err.response) return "اتصال به سرور برقرار نشد. اینترنت یا آدرس سرور را بررسی کنید";
  }
  return "خطای غیرمنتظره‌ای رخ داد";
}
