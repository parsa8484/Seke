import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppColors, ThemeMode, palettes } from "../theme/colors";

const STORAGE_KEY = "app-theme-preference";

// "system" یعنی از تنظیمات خود گوشی پیروی کن
export type ThemePreference = ThemeMode | "system";

interface ThemeContextValue {
  colors: AppColors;
  mode: ThemeMode; // تمی که همین الان فعاله
  preference: ThemePreference; // چیزی که کاربر انتخاب کرده
  isDark: boolean;
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");

  // انتخاب قبلی کاربر رو از حافظه‌ی گوشی بخون
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "dark" || saved === "light" || saved === "system") {
          setPreferenceState(saved);
        }
      })
      .catch(() => {
        // خوندن تنظیمات شکست خورد — با تم پیش‌فرض ادامه بده
      });
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {
      // ذخیره نشد — تم این اجرا درست کار می‌کنه ولی دفعه‌ی بعد یادش نمی‌مونه
    });
  }, []);

  const mode: ThemeMode =
    preference === "system" ? (systemScheme === "light" ? "light" : "dark") : preference;

  const toggle = useCallback(() => {
    setPreference(mode === "dark" ? "light" : "dark");
  }, [mode, setPreference]);

  const value = useMemo(
    () => ({
      colors: palettes[mode],
      mode,
      preference,
      isDark: mode === "dark",
      setPreference,
      toggle,
    }),
    [mode, preference, setPreference, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme باید داخل ThemeProvider استفاده بشه");
  return ctx;
}

/**
 * استایل‌های وابسته به تم رو یک بار می‌سازه و با تغییر تم دوباره می‌سازه.
 * الگوی استفاده:
 *   const styles = useThemedStyles(makeStyles);
 *   const makeStyles = (c: AppColors) => StyleSheet.create({ ... });
 */
export function useThemedStyles<T>(factory: (colors: AppColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
