import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Switch, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppText } from "../../../../src/components/AppText";
import { Card } from "../../../../src/components/Card";
import { PrimaryButton } from "../../../../src/components/PrimaryButton";
import { TextField } from "../../../../src/components/TextField";
import { LoginHistoryList } from "../../../../src/components/LoginHistoryList";
import {
  fetchAdminUserDetail,
  updateAdminUser,
  deleteAdminUser,
  resetUserPassword,
  fetchUserLoginHistory,
} from "../../../../src/api/admin";
import { extractErrorMessage } from "../../../../src/api/client";
import { useAuth } from "../../../../src/context/AuthContext";
import { spacing } from "../../../../src/theme/colors";
import { useTheme } from "../../../../src/context/ThemeContext";
import type { AppColors } from "../../../../src/theme/colors";
import { formatToman } from "../../../../src/utils/format";
import { AdminUserHolding } from "../../../../src/api/types";

export default function AdminUserDetailScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => fetchAdminUserDetail(id),
    enabled: !!id,
  });

  const patchMutation = useMutation({
    mutationFn: (patch: { role?: "user" | "admin"; isActive?: boolean }) =>
      updateAdminUser(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => Alert.alert("خطا", extractErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAdminUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      router.back();
    },
    onError: (err) => Alert.alert("خطا", extractErrorMessage(err)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => resetUserPassword(id, newPassword),
    onSuccess: (res) => {
      setNewPassword("");
      setShowPasswordForm(false);
      Alert.alert("انجام شد", res.message);
    },
    onError: (err) => Alert.alert("خطا", extractErrorMessage(err)),
  });

  const { data: loginHistory } = useQuery({
    queryKey: ["admin-user-login-history", id],
    queryFn: () => fetchUserLoginHistory(id),
    enabled: !!id,
  });

  function handleResetPassword() {
    if (newPassword.length < 6) {
      Alert.alert("خطا", "رمز جدید باید حداقل ۶ کاراکتر باشد");
      return;
    }
    Alert.alert(
      "تغییر رمز عبور",
      "رمز عبور این کاربر تغییر می‌کند و رمز قبلی‌اش دیگر کار نخواهد کرد. مطمئنی؟",
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "تغییر بده",
          style: "destructive",
          onPress: () => resetPasswordMutation.mutate(),
        },
      ]
    );
  }

  function confirmDelete() {
    Alert.alert(
      "حذف کاربر",
      "این کاربر و تمام دارایی‌های ثبت‌شده‌اش برای همیشه حذف می‌شود. مطمئنی؟",
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <AppText>در حال بارگذاری...</AppText>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <AppText style={{ color: colors.danger }}>
          {error ? extractErrorMessage(error) : "کاربر پیدا نشد"}
        </AppText>
      </View>
    );
  }

  const isSelf = me?.id === data.user.id;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card style={styles.profileCard}>
        <AppText style={styles.email}>{data.user.email}</AppText>
        {data.user.username ? (
          <AppText style={styles.meta}>@{data.user.username}</AppText>
        ) : null}
        <AppText style={styles.meta}>
          {data.user.displayName || "بدون نام"}
        </AppText>
        <AppText style={styles.meta}>
          ارزش کل دارایی‌ها: {formatToman(data.totalValue)} تومان
        </AppText>
      </Card>

      <Card style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <Switch
            value={data.user.role === "admin"}
            disabled={isSelf || patchMutation.isPending}
            onValueChange={(v) =>
              patchMutation.mutate({ role: v ? "admin" : "user" })
            }
            trackColor={{ true: colors.gold }}
          />
          <AppText style={styles.settingLabel}>دسترسی ادمین</AppText>
        </View>
        <View style={styles.settingRow}>
          <Switch
            value={data.user.isActive}
            disabled={isSelf || patchMutation.isPending}
            onValueChange={(v) => patchMutation.mutate({ isActive: v })}
            trackColor={{ true: colors.success }}
          />
          <AppText style={styles.settingLabel}>حساب فعال است</AppText>
        </View>
        {isSelf ? (
          <AppText style={styles.selfNote}>
            نمی‌توانید تنظیمات حساب خودتان را از اینجا تغییر دهید
          </AppText>
        ) : null}
      </Card>

      <Card style={styles.settingsCard}>
        <AppText style={styles.cardTitle}>رمز عبور</AppText>
        {showPasswordForm ? (
          <>
            <TextField
              label="رمز عبور جدید"
              placeholder="حداقل ۶ کاراکتر"
              secureTextEntry
              autoCapitalize="none"
              value={newPassword}
              onChangeText={setNewPassword}
              hint="کاربر با این رمز جدید وارد می‌شود — حتماً به او اطلاع دهید"
            />
            <View style={styles.buttonRow}>
              <PrimaryButton
                title="انصراف"
                variant="outline"
                onPress={() => {
                  setShowPasswordForm(false);
                  setNewPassword("");
                }}
                style={styles.flexButton}
              />
              <PrimaryButton
                title="تغییر رمز"
                onPress={handleResetPassword}
                loading={resetPasswordMutation.isPending}
                style={styles.flexButton}
              />
            </View>
          </>
        ) : (
          <PrimaryButton
            title="🔑 تغییر رمز عبور این کاربر"
            variant="outline"
            onPress={() => setShowPasswordForm(true)}
          />
        )}
      </Card>

      <AppText style={styles.sectionTitle}>تاریخچه‌ی ورود</AppText>
      <Card style={styles.settingsCard}>
        <LoginHistoryList events={loginHistory ?? []} />
      </Card>

      <AppText style={styles.sectionTitle}>دارایی‌های ثبت‌شده</AppText>
      {data.holdings.length === 0 ? (
        <AppText style={styles.empty}>این کاربر هنوز دارایی ثبت نکرده</AppText>
      ) : (
        <Card style={styles.holdingsCard}>
          {data.holdings.map((h: AdminUserHolding) => (
            <View key={h.assetKey} style={styles.holdingRow}>
              <AppText style={styles.holdingValue}>
                {formatToman(h.value)} ت
              </AppText>
              <AppText style={styles.holdingLabel}>
                {h.label} × {h.quantity}
              </AppText>
            </View>
          ))}
        </Card>
      )}

      {!isSelf ? (
        <PrimaryButton
          title="حذف این کاربر"
          variant="danger"
          onPress={confirmDelete}
          loading={deleteMutation.isPending}
        />
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  container: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  profileCard: { alignItems: "flex-end", marginBottom: spacing.md },
  email: { fontSize: 16, fontWeight: "700" },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  settingsCard: { marginBottom: spacing.lg },
  settingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  settingLabel: { fontSize: 14 },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.goldSoft,
    textAlign: "right",
    marginBottom: spacing.sm,
  },
  buttonRow: { flexDirection: "row-reverse", gap: spacing.sm },
  flexButton: { flex: 1 },
  selfNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: spacing.sm,
  },
  holdingsCard: { marginBottom: spacing.lg },
  holdingRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  holdingLabel: { fontSize: 13, color: colors.textSecondary },
  holdingValue: { fontSize: 13, fontWeight: "700", color: colors.goldSoft },
  empty: { color: colors.textSecondary, textAlign: "right", marginBottom: spacing.lg },
});
