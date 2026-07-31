import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import { TOKEN_KEY } from "../api/client";
import * as authApi from "../api/auth";
import { User } from "../api/types";

// توکنِ «به‌خاطر سپرده» برای ورود سریع با اثر انگشت. جدا از TOKEN_KEY نگه
// داشته می‌شود تا خروج از حساب، جلسه‌ی فعال را ببندد ولی امکان ورود دوباره
// با اثر انگشت (بدون تایپ رمز) باقی بماند. هر ورودِ موفق تازه‌اش می‌کند.
const REMEMBER_KEY = "sekeh_biometric_token";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean; // در حال چک‌کردن توکن ذخیره‌شده هنگام باز شدن اپ
  isAdmin: boolean;
  /** روی این دستگاه قبلاً کسی وارد شده و می‌شود با اثر انگشت برگشت */
  hasRememberedSession: boolean;
  /** توکن به‌خاطرسپرده را برمی‌گرداند. باید بعد از تأیید بیومتریک صدا زده شود */
  signInWithRememberedSession: () => Promise<void>;
  /** پاک‌کردن ورود سریع این دستگاه */
  forgetDevice: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    username: string,
    password: string,
    displayName?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  // بعد از ویرایش پروفایل، اطلاعات کاربر رو از سرور تازه‌سازی می‌کنه
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRememberedSession, setHasRememberedSession] = useState(false);

  // هنگام باز شدن اپ: اگه توکن قبلاً ذخیره شده، سعی کن کاربر رو بازیابی کن
  // تا مجبور نباشه دوباره لاگین کنه
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        let remembered = await SecureStore.getItemAsync(REMEMBER_KEY);

        // کاربری که *قبل* از اضافه‌شدن ورود سریع لاگین کرده، توکن به‌خاطرسپرده
        // ندارد و دکمه‌ی اثر انگشت برایش ظاهر نمی‌شد مگر یک بار خروج و ورود
        // دستی می‌کرد. جلسه‌ی فعالِ موجود را همین‌جا به‌عنوان توکن ورود سریع
        // ثبت می‌کنیم.
        if (savedToken && !remembered) {
          await SecureStore.setItemAsync(REMEMBER_KEY, savedToken);
          remembered = savedToken;
        }
        setHasRememberedSession(Boolean(remembered));

        if (savedToken) {
          setToken(savedToken);
          const me = await authApi.fetchMe();
          setUser(me);
        }
      } catch {
        // توکن نامعتبر/منقضی - پاکش کن و کاربر رو به صفحه‌ی ورود بفرست
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persistSession = useCallback(async (newToken: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    await SecureStore.setItemAsync(REMEMBER_KEY, newToken);
    setHasRememberedSession(true);
    setToken(newToken);
  }, []);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const res = await authApi.login(identifier, password);
      await persistSession(res.token);
      setUser(res.user);
    },
    [persistSession]
  );

  const forgetDevice = useCallback(async () => {
    await SecureStore.deleteItemAsync(REMEMBER_KEY);
    setHasRememberedSession(false);
  }, []);

  /**
   * ورود بدون رمز با توکنی که از آخرین ورود مانده. صدا زدنش باید *بعد* از
   * تأیید بیومتریک باشد؛ خودش هویت‌سنجی نمی‌کند.
   */
  const signInWithRememberedSession = useCallback(async () => {
    const saved = await SecureStore.getItemAsync(REMEMBER_KEY);
    if (!saved) {
      throw new Error("ورود سریع روی این دستگاه ثبت نشده است");
    }
    // اول توکن را می‌نویسیم چون اینترسپتور axios آن را از SecureStore می‌خواند
    await SecureStore.setItemAsync(TOKEN_KEY, saved);
    try {
      const me = await authApi.fetchMe();
      setToken(saved);
      setUser(me);
    } catch (err) {
      // توکن منقضی یا حساب غیرفعال شده — ورود سریع دیگر معتبر نیست
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await forgetDevice();
      throw new Error("ورود سریع منقضی شده؛ لطفاً با رمز عبور وارد شوید");
    }
  }, [forgetDevice]);

  const signUp = useCallback(
    async (
      email: string,
      username: string,
      password: string,
      displayName?: string
    ) => {
      const res = await authApi.register(email, username, password, displayName);
      await persistSession(res.token);
      setUser(res.user);
    },
    [persistSession]
  );

  const signOut = useCallback(async () => {
    // REMEMBER_KEY عمداً پاک نمی‌شود: کاربر بعد از خروج هم می‌تواند با اثر
    // انگشت برگردد. برای پاک‌کردن کامل، forgetDevice() هست.
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await authApi.fetchMe());
    } catch {
      // شکست در تازه‌سازی نباید کاربر رو از حساب بیرون بندازه؛
      // اطلاعات قبلی همچنان معتبره
    }
  }, []);

  const isAdmin = user?.role === "admin";

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAdmin,
      hasRememberedSession,
      signIn,
      signUp,
      signOut,
      refreshUser,
      signInWithRememberedSession,
      forgetDevice,
    }),
    [
      user,
      token,
      isLoading,
      isAdmin,
      hasRememberedSession,
      signIn,
      signUp,
      signOut,
      refreshUser,
      signInWithRememberedSession,
      forgetDevice,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth باید داخل AuthProvider استفاده بشه");
  return ctx;
}
