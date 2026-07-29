import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../../src/components/AppText";
import { Card } from "../../../src/components/Card";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { fetchAdminStats, triggerPriceRefresh } from "../../../src/api/admin";
import { extractErrorMessage } from "../../../src/api/client";
import { colors, spacing, radius } from "../../../src/theme/colors";
import { formatToman } from "../../../src/utils/format";

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

function NavRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.7 }]}>
      <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
      <View style={styles.navRowText}>
        <AppText style={styles.navRowTitle}>{title}</AppText>
        <AppText style={styles.navRowSubtitle}>{subtitle}</AppText>
      </View>
      <View style={styles.navIcon}>
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
    </Pressable>
  );
}

export default function AdminOverviewScreen() {
  const queryClient = useQueryClient();
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
  });

  const refreshMutation = useMutation({
    mutationFn: triggerPriceRefresh,
    onSuccess: (res) => {
      setRefreshMsg(`${res.updated} قیمت به‌روزرسانی شد`);
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["holdings-summary"] });
    },
    onError: (err) => setRefreshMsg(extractErrorMessage(err)),
  });

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {isLoading ? (
        <AppText>در حال بارگذاری...</AppText>
      ) : error ? (
        <AppText style={styles.errorText}>{extractErrorMessage(error)}</AppText>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <StatBox label="کل کاربران" value={String(data!.userCount)} />
            <StatBox label="کاربران فعال" value={String(data!.activeUserCount)} />
            <StatBox
              label="ارزش کل دارایی‌های ثبت‌شده"
              value={`${formatToman(data!.totalHoldingsValue)} ت`}
            />
            <StatBox
              label="وضعیت BrsApi"
              value={data!.brsapiConfigured ? "متصل" : "کلید ندارد"}
            />
          </View>

          {data!.assetsMissingPrice.length > 0 ? (
            <Card style={styles.warningCard}>
              <AppText style={styles.warningTitle}>
                دارایی‌های بدون قیمت آنلاین
              </AppText>
              {data!.assetsMissingPrice.map((a: { key: string; label: string }) => (
                <AppText key={a.key} style={styles.warningItem}>
                  • {a.label}
                </AppText>
              ))}
            </Card>
          ) : null}

          {refreshMsg ? (
            <AppText style={styles.refreshMsg}>{refreshMsg}</AppText>
          ) : null}
          <PrimaryButton
            title="بروزرسانی دستی قیمت‌ها"
            onPress={() => refreshMutation.mutate()}
            loading={refreshMutation.isPending}
            style={{ marginBottom: spacing.lg }}
          />
        </>
      )}

      <Card>
        <NavRow
          icon="people"
          title="مدیریت کاربران"
          subtitle="لیست، تغییر نقش، فعال/غیرفعال‌سازی"
          onPress={() => router.push("/(app)/admin/users")}
        />
        <View style={styles.divider} />
        <NavRow
          icon="pricetags"
          title="مدیریت دارایی‌ها"
          subtitle="افزودن/ویرایش سکه، صندوق، دارایی دستی"
          onPress={() => router.push("/(app)/admin/assets")}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  errorText: { color: colors.danger, textAlign: "right" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flexBasis: "48%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "flex-end",
  },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.gold },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  warningCard: {
    borderColor: colors.danger,
    marginBottom: spacing.md,
    alignItems: "flex-end",
  },
  warningTitle: { fontWeight: "700", color: colors.danger, marginBottom: spacing.xs },
  warningItem: { color: colors.textSecondary, fontSize: 13 },
  refreshMsg: { color: colors.textSecondary, textAlign: "right", marginBottom: spacing.sm },
  navRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  navRowText: { flex: 1, alignItems: "flex-end" },
  navRowTitle: { fontSize: 15, fontWeight: "700" },
  navRowSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  navIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: colors.border },
});
