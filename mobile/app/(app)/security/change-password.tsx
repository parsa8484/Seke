import React, { useState } from "react";
import {
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { AppText } from "../../../src/components/AppText";
import { Card } from "../../../src/components/Card";
import { TextField } from "../../../src/components/TextField";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { useTheme } from "../../../src/context/ThemeContext";
import { changePassword } from "../../../src/api/auth";
import { extractErrorMessage } from "../../../src/api/client";
import { spacing } from "../../../src/theme/colors";

export default function ChangePasswordScreen() {
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: (res) => {
      setError(null);
      setSuccess(res.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => router.back(), 1500);
    },
    onError: (err) => {
      setSuccess(null);
      setError(extractErrorMessage(err));
    },
  });

  function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (!currentPassword || !newPassword) {
      setError("همه‌ی فیلدها را پر کنید");
      return;
    }
    if (newPassword.length < 6) {
      setError("رمز جدید باید حداقل ۶ کاراکتر باشد");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("رمز جدید و تکرار آن یکسان نیستند");
      return;
    }
    if (newPassword === currentPassword) {
      setError("رمز جدید نباید با رمز فعلی یکسان باشد");
      return;
    }
    mutation.mutate();
  }

  // یک سنجه‌ی ساده‌ی قدرت رمز — فقط راهنمای بصری، سخت‌گیری واقعی سمت سروره
  const strength = (() => {
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  })();
  const strengthLabels = ["خیلی ضعیف", "ضعیف", "متوسط", "خوب", "عالی"];
  const strengthColors = [
    colors.danger,
    colors.danger,
    colors.goldSoft,
    colors.success,
    colors.success,
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <AppText style={[styles.hint, { color: colors.textSecondary }]}>
            برای تغییر رمز، ابتدا رمز فعلی خود را وارد کنید.
          </AppText>

          <TextField
            label="رمز عبور فعلی"
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <TextField
            label="رمز عبور جدید"
            placeholder="حداقل ۶ کاراکتر"
            secureTextEntry
            autoCapitalize="none"
            value={newPassword}
            onChangeText={setNewPassword}
          />

          {newPassword.length > 0 ? (
            <View style={styles.strengthRow}>
              <AppText
                style={[styles.strengthText, { color: strengthColors[strength] }]}
              >
                قدرت رمز: {strengthLabels[strength]}
              </AppText>
            </View>
          ) : null}

          <TextField
            label="تکرار رمز عبور جدید"
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {error ? (
            <AppText style={[styles.message, { color: colors.danger }]}>
              {error}
            </AppText>
          ) : null}
          {success ? (
            <AppText style={[styles.message, { color: colors.success }]}>
              ✓ {success}
            </AppText>
          ) : null}

          <PrimaryButton
            title="تغییر رمز عبور"
            onPress={handleSubmit}
            loading={mutation.isPending}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.md },
  hint: {
    fontSize: 13,
    textAlign: "right",
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  strengthRow: { alignItems: "flex-end", marginTop: -spacing.sm, marginBottom: spacing.md },
  strengthText: { fontSize: 12, fontWeight: "600" },
  message: { textAlign: "right", marginBottom: spacing.md, fontSize: 13 },
});
