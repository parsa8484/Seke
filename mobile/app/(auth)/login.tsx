import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../src/components/AppText";
import { TextField } from "../../src/components/TextField";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import { useLock } from "../../src/context/LockContext";
import { useTheme } from "../../src/context/ThemeContext";
import { extractErrorMessage } from "../../src/api/client";
import { spacing, radius } from "../../src/theme/colors";

export default function LoginScreen() {
  const { signIn, hasRememberedSession, signInWithRememberedSession } =
    useAuth();
  const { support, methodLabel, authenticate } = useLock();
  const { colors, isDark, toggle } = useTheme();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  // فقط وقتی معنی دارد که هم دستگاه بیومتریک ثبت‌شده داشته باشد و هم قبلاً
  // کسی روی این گوشی وارد شده باشد (وگرنه توکنی برای بازگرداندن نیست)
  const canBiometricLogin = support === "available" && hasRememberedSession;

  async function handleSubmit() {
    setError(null);
    if (!identifier.trim() || !password) {
      setError("ایمیل/نام کاربری و رمز عبور را وارد کنید");
      return;
    }
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
      router.replace("/(app)");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    setBioLoading(true);
    try {
      const ok = await authenticate(`ورود به دارایار با ${methodLabel}`);
      if (!ok) {
        // پیام فرم بالای صفحه‌ست، دور از دکمه‌ای که کاربر همین الان زده —
        // Alert تضمین می‌کنه که حتماً دیده بشه، نه اینکه انگار «هیچ اتفاقی
        // نیفتاد» به نظر برسه.
        Alert.alert("ورود ناموفق", "تأیید هویت انجام نشد. دوباره تلاش کنید.");
        return;
      }
      await signInWithRememberedSession();
      router.replace("/(app)");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : extractErrorMessage(err);
      Alert.alert("ورود ناموفق", message);
    } finally {
      setBioLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={toggle}
          style={[
            styles.themeToggle,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <AppText style={styles.themeToggleIcon}>
            {isDark ? "☀️" : "🌙"}
          </AppText>
        </Pressable>

        <View style={styles.header}>
          <AppText style={[styles.brand, { color: colors.gold }]}>
            دارایار
          </AppText>
          <AppText style={[styles.subtitle, { color: colors.textSecondary }]}>
            ارزش لحظه‌ای سکه، طلا و صندوق‌های شما — یک‌جا
          </AppText>
        </View>

        <TextField
          label="ایمیل یا نام کاربری"
          placeholder="example@email.com یا username"
          autoCapitalize="none"
          autoCorrect={false}
          value={identifier}
          onChangeText={setIdentifier}
        />
        <TextField
          label="رمز عبور"
          placeholder="••••••••"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          onPress={() => setShowPassword((v) => !v)}
          style={styles.showPasswordRow}
        >
          <AppText style={[styles.showPassword, { color: colors.textSecondary }]}>
            {showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
          </AppText>
        </Pressable>

        {error ? (
          <AppText style={[styles.error, { color: colors.danger }]}>
            {error}
          </AppText>
        ) : null}

        <PrimaryButton title="ورود" onPress={handleSubmit} loading={loading} />

        {canBiometricLogin ? (
          <View style={styles.bioBlock}>
            <View style={styles.dividerRow}>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
              <AppText style={[styles.dividerText, { color: colors.textMuted }]}>
                یا
              </AppText>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
            </View>

            <Pressable
              onPress={handleBiometricLogin}
              disabled={bioLoading}
              style={({ pressed }) => [
                styles.bioButton,
                {
                  borderColor: colors.gold,
                  backgroundColor: pressed
                    ? colors.surfaceElevated
                    : colors.surface,
                  opacity: bioLoading ? 0.6 : 1,
                },
              ]}
            >
              <View
                style={[styles.bioIconCircle, { backgroundColor: colors.gold }]}
              >
                <Ionicons
                  name="finger-print"
                  size={26}
                  color={colors.background}
                />
              </View>
              <View style={styles.bioTextBlock}>
                <AppText style={[styles.bioTitle, { color: colors.gold }]}>
                  {bioLoading
                    ? "در حال تأیید..."
                    : `ورود با ${methodLabel}`}
                </AppText>
                <AppText
                  style={[styles.bioSubtitle, { color: colors.textSecondary }]}
                >
                  بدون تایپ رمز، فقط با {methodLabel} وارد شوید
                </AppText>
              </View>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footer}>
          <AppText style={{ color: colors.textSecondary }}>
            حساب کاربری ندارید؟
          </AppText>
          <Link href="/(auth)/register" asChild>
            <AppText style={[styles.link, { color: colors.gold }]}>
              ثبت‌نام کنید
            </AppText>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  themeToggle: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  themeToggleIcon: { fontSize: 18 },
  header: { marginBottom: spacing.xl, alignItems: "flex-end" },
  brand: { fontSize: 34, fontWeight: "800" },
  subtitle: {
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: "right",
  },
  showPasswordRow: {
    alignSelf: "flex-end",
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  showPassword: { fontSize: 12 },
  error: {
    marginBottom: spacing.md,
    textAlign: "right",
  },
  bioBlock: { marginTop: spacing.lg },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  bioButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  bioIconCircle: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  bioTextBlock: { flex: 1, alignItems: "flex-end" },
  bioTitle: { fontSize: 15, fontWeight: "800" },
  bioSubtitle: { fontSize: 11, marginTop: 2, textAlign: "right" },
  footer: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  link: { fontWeight: "700" },
});
