import React, { useState } from "react";
import { StyleSheet, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { AppText } from "../../../src/components/AppText";
import { Card } from "../../../src/components/Card";
import { TextField } from "../../../src/components/TextField";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { useTheme } from "../../../src/context/ThemeContext";
import { useAuth } from "../../../src/context/AuthContext";
import { updateProfile } from "../../../src/api/auth";
import { extractErrorMessage } from "../../../src/api/client";
import { spacing } from "../../../src/theme/colors";

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateProfile(displayName.trim()),
    onSuccess: async () => {
      setError(null);
      setSuccess(true);
      await refreshUser();
      setTimeout(() => router.back(), 1200);
    },
    onError: (err) => {
      setSuccess(false);
      setError(extractErrorMessage(err));
    },
  });

  function handleSubmit() {
    setError(null);
    setSuccess(false);
    if (!displayName.trim()) {
      setError("نام نمایشی را وارد کنید");
      return;
    }
    mutation.mutate();
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
      <Card>
        <TextField
          label="نام نمایشی"
          placeholder="مثلا پارسا"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <View style={styles.readOnlyBlock}>
          <AppText style={[styles.readOnlyLabel, { color: colors.textSecondary }]}>
            نام کاربری
          </AppText>
          <AppText style={[styles.readOnlyValue, { color: colors.textMuted }]}>
            {user?.username ? `@${user.username}` : "—"}
          </AppText>
        </View>
        <View style={styles.readOnlyBlock}>
          <AppText style={[styles.readOnlyLabel, { color: colors.textSecondary }]}>
            ایمیل
          </AppText>
          <AppText style={[styles.readOnlyValue, { color: colors.textMuted }]}>
            {user?.email}
          </AppText>
        </View>
        <AppText style={[styles.note, { color: colors.textMuted }]}>
          نام کاربری و ایمیل قابل تغییر نیستند.
        </AppText>

        {error ? (
          <AppText style={[styles.message, { color: colors.danger }]}>
            {error}
          </AppText>
        ) : null}
        {success ? (
          <AppText style={[styles.message, { color: colors.success }]}>
            ✓ پروفایل به‌روزرسانی شد
          </AppText>
        ) : null}

        <PrimaryButton
          title="ذخیره"
          onPress={handleSubmit}
          loading={mutation.isPending}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.md },
  readOnlyBlock: { alignItems: "flex-end", marginBottom: spacing.md },
  readOnlyLabel: { fontSize: 13, marginBottom: spacing.xs },
  readOnlyValue: { fontSize: 15 },
  note: {
    fontSize: 11,
    textAlign: "right",
    marginBottom: spacing.md,
  },
  message: { textAlign: "right", marginBottom: spacing.md, fontSize: 13 },
});
