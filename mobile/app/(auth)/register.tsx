import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link, router } from "expo-router";
import { AppText } from "../../src/components/AppText";
import { TextField } from "../../src/components/TextField";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import { extractErrorMessage } from "../../src/api/client";
import { colors, spacing } from "../../src/theme/colors";

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("ایمیل و رمز عبور را وارد کنید");
      return;
    }
    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشد");
      return;
    }
    if (password !== confirmPassword) {
      setError("رمز عبور و تکرار آن یکسان نیستند");
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, displayName.trim() || undefined);
      router.replace("/(app)");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <AppText style={styles.brand}>ساخت حساب کاربری</AppText>
          <AppText style={styles.subtitle}>
            دارایی‌های خود را یک‌بار وارد کنید، همیشه در دسترس بماند
          </AppText>
        </View>

        <TextField
          label="نام (اختیاری)"
          placeholder="مثلا پارسا"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextField
          label="ایمیل"
          placeholder="example@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextField
          label="رمز عبور"
          placeholder="حداقل ۶ کاراکتر"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextField
          label="تکرار رمز عبور"
          placeholder="••••••••"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        <PrimaryButton title="ثبت‌نام" onPress={handleSubmit} loading={loading} />

        <View style={styles.footer}>
          <AppText style={styles.footerText}>قبلاً ثبت‌نام کرده‌اید؟</AppText>
          <Link href="/(auth)/login" asChild>
            <AppText style={styles.link}>وارد شوید</AppText>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  header: { marginBottom: spacing.xl, alignItems: "flex-end" },
  brand: { fontSize: 26, fontWeight: "800", color: colors.gold },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: "right",
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: "right",
  },
  footer: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  footerText: { color: colors.textSecondary },
  link: { color: colors.gold, fontWeight: "700" },
});
