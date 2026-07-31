// تم اپ در دو حالت تیره و روشن. رنگ طلایی در هر دو حالت رنگ برجسته می‌مونه
// (متناسب با موضوع اپ: طلا، سکه و صندوق) ولی در حالت روشن کمی تیره‌تره تا
// روی پس‌زمینه‌ی سفید خوانا بمونه.

export type ThemeMode = "dark" | "light";

export const darkColors = {
  background: "#0B0F17",
  surface: "#141A26",
  surfaceElevated: "#1C2436",
  border: "#2A3448",
  gold: "#D4AF37",
  goldSoft: "#E8C766",
  textPrimary: "#F5F3EE",
  textSecondary: "#9AA5B8",
  textMuted: "#6B7688",
  success: "#3DDC97",
  danger: "#FF6B6B",
  overlay: "rgba(0,0,0,0.5)",
};

export const lightColors: typeof darkColors = {
  background: "#F7F5F0",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  border: "#E2DED4",
  gold: "#A6801A",
  goldSoft: "#8A6A12",
  textPrimary: "#1A1D23",
  textSecondary: "#5C6473",
  textMuted: "#8A93A3",
  success: "#12855C",
  danger: "#C7362F",
  overlay: "rgba(0,0,0,0.35)",
};

export type AppColors = typeof darkColors;

export const palettes: Record<ThemeMode, AppColors> = {
  dark: darkColors,
  light: lightColors,
};

// رنگ‌های ثابت نمودار — در هر دو تم خوانا هستن
export const chartPalette = [
  "#D4AF37",
  "#4C9AFF",
  "#3DDC97",
  "#F78C6B",
  "#B388FF",
  "#FF6B9D",
  "#26C6DA",
  "#FFD166",
];

// سازگاری با کدهای قبلی که مستقیم `colors` رو import می‌کردن.
// کد جدید باید از useTheme() استفاده کنه تا با تغییر تم به‌روز بشه.
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const },
  h2: { fontSize: 20, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  label: { fontSize: 13, fontWeight: "600" as const },
};
