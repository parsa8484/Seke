// تبدیل تاریخ میلادی به شمسی — کاملاً محاسباتی و بدون وابستگی.
//
// چرا دستی؟ چون `Intl.DateTimeFormat("fa-IR")` روی اندروید کار نمی‌کنه:
// موتور Hermes در ری‌اکت‌نیتیو بدون ICU کامل بیلد می‌شه، پس درخواست تقویم
// فارسی بی‌صدا به میلادیِ انگلیسی fallback می‌کنه. دقیقاً همون باگی که
// باعث می‌شد تاریخ‌های اپ میلادی نشون داده بشن.
//
// الگوریتم: تبدیل میلادی → روز ژولیَن → شمسی (الگوریتم استاندارد جلالی).

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export const JALALI_WEEKDAYS = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

export interface JalaliDate {
  year: number;
  month: number; // ۱ تا ۱۲
  day: number;
}

// تقسیم و باقی‌مانده‌ی «برش به سمت صفر» (نه floor). این تفاوت مهمه: الگوریتم
// جلالی روی همین معنا بنا شده و با floor نتیجه یک سال جابه‌جا می‌شه.
function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

function mod(a: number, b: number): number {
  return a - Math.trunc(a / b) * b;
}

// سال‌های «شکست» در تقویم جلالی — نقاطی که الگوی کبیسه عوض می‌شه.
// این جدول و الگوریتم زیرش استاندارد و آزموده‌ست (همون چیزی که کتابخانه‌ی
// jalaali-js استفاده می‌کنه)؛ خودمون از نو اختراعش نمی‌کنیم چون خطای یک‌روزه
// در تقویم، بی‌صدا و آزاردهنده‌ست.
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
  2262, 2324, 2394, 2456, 3178,
];

interface JalCal {
  leap: number; // ۰ یعنی سال جاری کبیسه است
  gy: number;
  march: number; // روزِ ماه مارس که اول فروردین روی آن می‌افتد
}

function jalCal(jy: number): JalCal {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;

  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

/** میلادی → شماره‌ی روز ژولیَن */
function gregorianToJdn(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** شماره‌ی روز ژولیَن → سال میلادی */
function jdnToGregorianYear(jdn: number): number {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gm = mod(div(i, 153), 12) + 1;
  return div(j, 1461) - 100100 + div(8 - gm, 6);
}

export function toJalali(date: Date): JalaliDate {
  const jdn = gregorianToJdn(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  const gy = jdnToGregorianYear(jdn);
  let jy = gy - 621;
  const r = jalCal(jy);
  const firstDayOfYear = gregorianToJdn(r.gy, 3, r.march);

  let k = jdn - firstDayOfYear;
  if (k >= 0) {
    if (k <= 185) {
      return { year: jy, month: 1 + div(k, 31), day: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { year: jy, month: 7 + div(k, 30), day: mod(k, 30) + 1 };
}

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parse(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "۸ مرداد ۱۴۰۵" */
export function formatJalaliDate(input: string | Date | null | undefined): string {
  const date = parse(input);
  if (!date) return "—";
  const j = toJalali(date);
  return toPersianDigits(`${j.day} ${JALALI_MONTHS[j.month - 1]} ${j.year}`);
}

/** "۱۴۰۵/۰۵/۰۸" */
export function formatJalaliShort(
  input: string | Date | null | undefined
): string {
  const date = parse(input);
  if (!date) return "—";
  const j = toJalali(date);
  return toPersianDigits(`${j.year}/${pad2(j.month)}/${pad2(j.day)}`);
}

/** "۸ مرداد ۱۴۰۵ — ۱۴:۳۰" */
export function formatJalaliDateTime(
  input: string | Date | null | undefined
): string {
  const date = parse(input);
  if (!date) return "—";
  const j = toJalali(date);
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return toPersianDigits(
    `${j.day} ${JALALI_MONTHS[j.month - 1]} ${j.year} — ${time}`
  );
}

/** فقط ساعت: "۱۴:۳۰" */
export function formatTime(input: string | Date | null | undefined): string {
  const date = parse(input);
  if (!date) return "—";
  return toPersianDigits(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);
}

/** "۸ مرداد" — برای محور نمودار که جا کمه */
export function formatJalaliDayMonth(
  input: string | Date | null | undefined
): string {
  const date = parse(input);
  if (!date) return "—";
  const j = toJalali(date);
  return toPersianDigits(`${j.day} ${JALALI_MONTHS[j.month - 1]}`);
}

/**
 * تاریخ شمسیِ آماده‌ای که خود tgju می‌ده ("1405/05/08") رو فقط فارسی‌سازی
 * می‌کنه — نیازی به تبدیل مجدد نیست و از خطای گرد کردن جلوگیری می‌کنه.
 */
export function formatTgjuJalali(jdate: string | null | undefined): string {
  if (!jdate) return "—";
  const parts = jdate.split("/");
  if (parts.length !== 3) return toPersianDigits(jdate);
  const [y, m, d] = parts;
  const monthName = JALALI_MONTHS[Number(m) - 1];
  if (!monthName) return toPersianDigits(jdate);
  return toPersianDigits(`${Number(d)} ${monthName} ${y}`);
}

export function formatTgjuJalaliShort(jdate: string | null | undefined): string {
  if (!jdate) return "—";
  const parts = jdate.split("/");
  if (parts.length !== 3) return toPersianDigits(jdate);
  const monthName = JALALI_MONTHS[Number(parts[1]) - 1];
  if (!monthName) return toPersianDigits(jdate);
  return toPersianDigits(`${Number(parts[2])} ${monthName}`);
}
