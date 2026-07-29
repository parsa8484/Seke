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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("ایمیل و رمز عبور را وارد کنید");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
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
          <AppText style={styles.brand}>دارایی من</AppText>
          <AppText style={styles.subtitle}>
            ورود به حساب کاربری برای مشاهده‌ی ارزش لحظه‌ای دارایی‌هایتان
          </AppText>
        </View>

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
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        <PrimaryButton title="ورود" onPress={handleSubmit} loading={loading} />

        <View style={styles.footer}>
          <AppText style={styles.footerText}>حساب کاربری ندارید؟</AppText>
          <Link href="/(auth)/register" asChild>
            <AppText style={styles.link}>ثبت‌نام کنید</AppText>
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
  brand: { fontSize: 30, fontWeight: "800", color: colors.gold },
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
