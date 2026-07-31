// فرمت اعداد و تاریخ‌ها.
//
// نکته‌ی مهم: هیچ‌جا به `Intl` تکیه نمی‌کنیم. موتور Hermes در اندروید بدون ICU
// کامل بیلد می‌شه، پس `Intl.NumberFormat("fa-IR")` ارقام فارسی نمی‌ده و
// `Intl.DateTimeFormat("fa-IR")` تاریخ میلادی برمی‌گردونه. همه‌چیز دستی
// فرمت می‌شه تا خروجی روی هر دستگاهی یکسان باشه.

import {
  formatJalaliDate,
  formatJalaliDateTime,
  formatJalaliShort,
  formatTime,
  toPersianDigits,
} from "./jalali";

export { toPersianDigits };
export {
  formatJalaliDate,
  formatJalaliDateTime,
  formatJalaliShort,
  formatJalaliDayMonth,
  formatTgjuJalali,
  formatTgjuJalaliShort,
  formatTime,
} from "./jalali";

/** جداکننده‌ی هزارگان دستی: 1234567 → "1,234,567" */
function groupThousands(value: number, maxFractionDigits = 0): string {
  const fixed =
    maxFractionDigits > 0
      ? String(Number(value.toFixed(maxFractionDigits)))
      : String(Math.round(value));
  const negative = fixed.startsWith("-");
  const abs = negative ? fixed.slice(1) : fixed;
  const [intPart, fracPart] = abs.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-" : "") + (fracPart ? `${grouped}.${fracPart}` : grouped);
}

export function formatToman(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  // اعداد کوچک (مثل قیمت یک واحد صندوق) گاهی اعشار دارن و گرد کردنشون
  // اطلاعات مفیدی رو از بین می‌بره
  const decimals = Math.abs(value) > 0 && Math.abs(value) < 1000 ? 2 : 0;
  return toPersianDigits(groupThousands(value, decimals));
}

// نمایش کوتاه برای اعداد بزرگ، مثلا ۱۸۹.۵ میلیون یا ۱.۲ میلیارد
export function formatTomanShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const fmt = (n: number) => toPersianDigits(groupThousands(n, 1));

  if (abs >= 1_000_000_000_000) return `${fmt(value / 1_000_000_000_000)} همت`;
  if (abs >= 1_000_000_000) return `${fmt(value / 1_000_000_000)} میلیارد`;
  if (abs >= 1_000_000) return `${fmt(value / 1_000_000)} میلیون`;
  if (abs >= 1_000) return `${fmt(value / 1_000)} هزار`;
  return fmt(value);
}

// قیمت دلاری — با ارقام لاتین چون نماد $ و عدد لاتین کنار هم طبیعی‌ترن
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return groupThousands(value, Math.abs(value) < 10 ? 4 : 2);
}

/** درصد با علامت: "+۲.۳٪" / "-۱.۱٪" */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${toPersianDigits(sign + value.toFixed(2))}٪`;
}

/** مبلغ با علامت — برای سود/زیان */
export function formatSignedToman(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return sign + formatToman(Math.abs(value));
}

// تاریخ و ساعت دقیق به شمسی — برای وقتی که «۳ ساعت پیش» کافی نیست
export function formatDateTime(iso: string | null | undefined): string {
  return formatJalaliDateTime(iso);
}

export function formatDate(iso: string | null | undefined): string {
  return formatJalaliDate(iso);
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "بدون داده";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "بدون داده";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "همین الان";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toPersianDigits(days)} روز پیش`;
  // بیشتر از یک ماه که شد، تاریخ دقیق شمسی خواناتره
  return formatJalaliShort(iso);
}
