import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import { TOKEN_KEY, isAuthRejection } from "../api/client";
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
  // تا مجبور نباشه دوباره لاگین کنه.
  //
  // نکته‌ی مهم: توکن را *خوش‌بینانه* می‌پذیریم (setToken قبل از تأیید سرور).
  // قبلاً هر خطایی در fetchMe — حتی قطع موقت اینترنت یا خواب‌رفتن سرور —
  // باعث پاک‌شدن توکن و پرتاب کاربر به صفحه‌ی ورود می‌شد؛ روی شبکه‌ی موبایل
  // همین چند ثانیه بی‌اتصالی کافی بود که کاربر کامل لاگ‌اوت شود و مجبور شود
  // دوباره با رمز وارد شود. فقط رد واقعی از سمت سرور (توکن نامعتبر/منقضی،
  // حساب غیرفعال) باید لاگ‌اوت واقعی بسازد.
  useEffect(() => {
    (async () => {
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
        try {
          const me = await authApi.fetchMe();
          setUser(me);
        } catch (err) {
          if (isAuthRejection(err)) {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await SecureStore.deleteItemAsync(REMEMBER_KEY);
            setHasRememberedSession(false);
            setToken(null);
            setUser(null);
          }
          // وگرنه (خطای شبکه/سرور): توکن دست‌نخورده می‌ماند، کاربر همچنان
          // وارد است؛ اطلاعات پروفایل با اولین کوئری موفق بعدی پر می‌شود
        }
      }
      setIsLoading(false);
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

  /**
   * ورود بدون رمز با توکنی که از آخرین ورود مانده. صدا زدنش باید *بعد* از
   * تأیید بیومتریک باشد؛ خودش هویت‌سنجی نمی‌کند.
   *
   * توکن *خوش‌بینانه* و بلافاصله ست می‌شود (قبل از تأیید سرور) تا کاربر
   * فوراً وارد اپ شود؛ درخواست fetchMe در پس‌زمینه پروفایل را کامل می‌کند.
   * فقط اگر سرور واقعاً توکن را رد کند (۴۰۱/۴۰۳/۴۰۴) لاگ‌اوت واقعی رخ
   * می‌دهد — قطعی موقت شبکه یا سرور کاربر را بیرون نمی‌اندازد.
   */
  const signInWithRememberedSession = useCallback(async () => {
    const saved = await SecureStore.getItemAsync(REMEMBER_KEY);
    if (!saved) {
      throw new Error("ورود سریع روی این دستگاه ثبت نشده است");
    }
    await SecureStore.setItemAsync(TOKEN_KEY, saved);
    setToken(saved);
    try {
      const me = await authApi.fetchMe();
      setUser(me);
    } catch (err) {
      if (isAuthRejection(err)) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REMEMBER_KEY);
        setHasRememberedSession(false);
        setToken(null);
        throw new Error("ورود سریع منقضی شده؛ لطفاً با رمز عبور وارد شوید");
      }
      // خطای شبکه/سرور: کاربر همچنان وارد می‌ماند (توکن معتبر بود، فقط
      // نتوانستیم پروفایل را همین الان بگیریم)
    }
  }, []);

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
    // REMEMBER_KEY عمداً پاک نمی‌شود: کاربر بعد از خروج هم باید بتواند فوراً
    // با اثر انگشت برگردد، بدون سؤال اضافه یا تایپ دوباره‌ی رمز.
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
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth باید داخل AuthProvider استفاده بشه");
  return ctx;
}
