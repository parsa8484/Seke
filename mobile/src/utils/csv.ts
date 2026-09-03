// ساخت فایل CSV از دارایی‌های کاربر (برای باز کردن در اکسل / گوگل‌شیت).
//
// دو نکته که اگر رعایت نشوند خروجی در اکسل خراب باز می‌شود:
//  ۱) BOM لازم است، وگرنه اکسل ویندوز فایل را با کدپیج سیستم می‌خواند و
//     نام‌های فارسی به‌صورت علامت‌های نامفهوم در می‌آیند.
//  ۲) عددها باید با ارقام *لاتین* و بدون جداکننده‌ی هزارگان نوشته شوند. هرچه
//     در اپ نمایش داده می‌شود ارقام فارسی دارد، ولی اکسل «۱۲۳» را عدد
//     نمی‌شناسد و به‌صورت متن نگه می‌دارد؛ آن‌وقت جمع و مرتب‌سازی کار نمی‌کند.

import { toJalali } from "./jalali";

export interface CsvHoldingRow {
  label: string;
  categoryLabel: string;
  unit: string;
  quantity: number;
  avgBuyPrice: number | null;
  price: number | null;
  value: number;
  profit: number | null;
  profitPercent: number | null;
}

export interface CsvTotals {
  total: number;
  cost: number | null;
  profit: number | null;
  profitPercent: number | null;
}

const COLUMNS = [
  "دارایی",
  "دسته",
  "واحد",
  "تعداد",
  "قیمت خرید هر واحد (تومان)",
  "قیمت روز (تومان)",
  "ارزش کل (تومان)",
  "سود یا زیان (تومان)",
  "درصد سود یا زیان",
];

/** عدد برای اکسل: ارقام لاتین، بدون کاما، حداکثر دو رقم اعشار. null → خالی */
function num(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return String(Number(value.toFixed(2)));
}

/** فرار دادن مقدار طبق RFC 4180 */
function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function row(values: string[]): string {
  return values.map(cell).join(",");
}

export function buildHoldingsCsv(
  rows: CsvHoldingRow[],
  totals: CsvTotals
): string {
  const lines = [
    row(COLUMNS),
    ...rows.map((r) =>
      row([
        r.label,
        r.categoryLabel,
        r.unit,
        num(r.quantity),
        num(r.avgBuyPrice),
        num(r.price),
        num(r.value),
        num(r.profit),
        num(r.profitPercent),
      ])
    ),
    // ردیف جمع در انتها می‌آید تا اگر کاربر جدول را مرتب کرد وسط داده‌ها نیفتد
    row([
      "جمع کل",
      "",
      "",
      "",
      "",
      "",
      num(totals.total),
      num(totals.profit),
      num(totals.profitPercent),
    ]),
  ];

  // CRLF چون اکسل ویندوز با LF تنها بعضی وقت‌ها همه‌ی سطرها را در یک خط نشان می‌دهد
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** نام فایل با تاریخ شمسیِ امروز و ارقام لاتین: "darayi-1405-06-12" */
export function holdingsCsvBaseName(date = new Date()): string {
  const { year, month, day } = toJalali(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `darayi-${year}-${pad(month)}-${pad(day)}`;
}
