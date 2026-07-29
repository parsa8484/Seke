import React from "react";
import { View, StyleSheet, ScrollView, Switch, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppText } from "../../../../src/components/AppText";
import { Card } from "../../../../src/components/Card";
import { PrimaryButton } from "../../../../src/components/PrimaryButton";
import {
  fetchAdminUserDetail,
  updateAdminUser,
  deleteAdminUser,
} from "../../../../src/api/admin";
import { extractErrorMessage } from "../../../../src/api/client";
import { useAuth } from "../../../../src/context/AuthContext";
import { colors, spacing } from "../../../../src/theme/colors";
import { formatToman } from "../../../../src/utils/format";
import { AdminUserHolding } from "../../../../src/api/types";

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();

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

const styles = StyleSheet.create({
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
