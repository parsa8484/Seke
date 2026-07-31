import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const PREF_KEY = "sekeh_biometric_lock";

// بعد از این مدت در پس‌زمینه، دوباره قفل می‌شه. کوتاه‌تر آزاردهنده می‌شه
// (هر بار سوییچ به مرورگر برای دیدن یک عدد)، بلندتر امنیتش کم می‌شه.
const RELOCK_AFTER_MS = 60_000;

export type BiometricSupport =
  | "available"
  | "not-enrolled" // سخت‌افزار هست ولی کاربر اثر انگشت/چهره ثبت نکرده
  | "unsupported";

interface LockContextValue {
  /** آیا کاربر قفل را روشن کرده */
  isEnabled: boolean;
  /** آیا همین حالا قفل است و باید صفحه‌ی قفل نشان داده شود */
  isLocked: boolean;
  /** در حال خواندن تنظیمات ذخیره‌شده هنگام باز شدن اپ */
  isLoading: boolean;
  support: BiometricSupport;
  /** نام روش موجود روی این دستگاه: "اثر انگشت" / "تشخیص چهره" */
  methodLabel: string;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  /** درخواست احراز هویت — true یعنی باز شد */
  unlock: () => Promise<boolean>;
}

const LockContext = createContext<LockContextValue | undefined>(undefined);

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [support, setSupport] = useState<BiometricSupport>("unsupported");
  const [methodLabel, setMethodLabel] = useState("اثر انگشت");

  const backgroundedAt = useRef<number | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current = isEnabled;
  }, [isEnabled]);

  useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();

        if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
          )
        ) {
          setMethodLabel("تشخیص چهره");
        } else if (
          types.includes(LocalAuthentication.AuthenticationType.IRIS)
        ) {
          setMethodLabel("اسکن عنبیه");
        }

        const supportState: BiometricSupport = !hasHardware
          ? "unsupported"
          : !enrolled
          ? "not-enrolled"
          : "available";
        setSupport(supportState);

        const saved = await AsyncStorage.getItem(PREF_KEY);
        const enabled = saved === "true" && supportState === "available";
        setIsEnabled(enabled);
        // اگر قفل روشنه، اپ از همون اول قفل باز می‌شه
        setIsLocked(enabled);
      } catch {
        setSupport("unsupported");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // رفتن به پس‌زمینه و برگشت بعد از مدتی → دوباره قفل
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state === "active" && enabledRef.current) {
        const since = backgroundedAt.current;
        if (since !== null && Date.now() - since > RELOCK_AFTER_MS) {
          setIsLocked(true);
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "برای باز کردن «دارایار» هویت خود را تأیید کنید",
      cancelLabel: "انصراف",
      // اگر بیومتریک چند بار شکست خورد، رمز/الگوی خود گوشی جایگزین بشه —
      // وگرنه کاربر با انگشت زخمی از اپش قفل می‌مونه.
      disableDeviceFallback: false,
    });
    if (result.success) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        // روشن کردن قفل فقط بعد از یک احراز هویت موفق — تا کسی که گوشی باز
        // را در دست دارد نتواند قفلی بگذارد که صاحب گوشی نتواند بازش کند.
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "برای فعال کردن قفل، هویت خود را تأیید کنید",
          cancelLabel: "انصراف",
          disableDeviceFallback: false,
        });
        if (!result.success) return false;
      }
      await AsyncStorage.setItem(PREF_KEY, enabled ? "true" : "false");
      setIsEnabled(enabled);
      setIsLocked(false);
      return true;
    },
    []
  );

  const value = useMemo(
    () => ({
      isEnabled,
      isLocked,
      isLoading,
      support,
      methodLabel,
      setEnabled,
      unlock,
    }),
    [isEnabled, isLocked, isLoading, support, methodLabel, setEnabled, unlock]
  );

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): LockContextValue {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error("useLock باید داخل LockProvider استفاده بشه");
  return ctx;
}
