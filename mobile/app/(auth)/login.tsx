import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { Link, router } from "expo-router";
import { AppText } from "../../src/components/AppText";
import { TextField } from "../../src/components/TextField";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import { useTheme } from "../../src/context/ThemeContext";
import { extractErrorMessage } from "../../src/api/client";
import { spacing, radius } from "../../src/theme/colors";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { colors, isDark, toggle } = useTheme();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
  footer: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  link: { fontWeight: "700" },
});
