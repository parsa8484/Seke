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

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean; // در حال چک‌کردن توکن ذخیره‌شده هنگام باز شدن اپ
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // هنگام باز شدن اپ: اگه توکن قبلاً ذخیره شده، سعی کن کاربر رو بازیابی کن
  // تا مجبور نباشه دوباره لاگین کنه
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
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

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await authApi.register(email, password, displayName);
      await SecureStore.setItemAsync(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
    },
    []
  );

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";

  const value = useMemo(
    () => ({ user, token, isLoading, isAdmin, signIn, signUp, signOut }),
    [user, token, isLoading, isAdmin, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth باید داخل AuthProvider استفاده بشه");
  return ctx;
}
