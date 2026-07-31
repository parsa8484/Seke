// فرمت اعداد به سبک فارسی + واحد تومان، با میان‌بر خوانا برای اعداد بزرگ

export function formatToman(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(
    value
  );
}

// نمایش کوتاه برای اعداد بزرگ، مثلا ۱۸۹.۵ میلیون یا ۱.۲ میلیارد
export function formatTomanShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const fmt = (n: number) =>
    new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(n);

  if (abs >= 1_000_000_000) return `${fmt(value / 1_000_000_000)} میلیارد`;
  if (abs >= 1_000_000) return `${fmt(value / 1_000_000)} میلیون`;
  if (abs >= 1_000) return `${fmt(value / 1_000)} هزار`;
  return fmt(value);
}

// قیمت دلاری — با جداکننده‌ی انگلیسی چون نماد $ و عدد لاتین کنار هم طبیعی‌ترن
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 10 ? 4 : 0,
  }).format(value);
}

export function toPersianDigits(input: string | number): string {
  const map: Record<string, string> = {
    "0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴",
    "5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹",
  };
  return String(input).replace(/[0-9]/g, (d) => map[d] ?? d);
}

// تاریخ و ساعت دقیق به شمسی — برای وقتی که «۳ ساعت پیش» کافی نیست
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "بدون داده";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  return `${toPersianDigits(days)} روز پیش`;
}
