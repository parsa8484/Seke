import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppText } from "../../src/components/AppText";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { AssetRow } from "../../src/components/AssetRow";
import { DonutChart, DonutSlice } from "../../src/components/DonutChart";
import { fetchHoldingsSummary, saveHoldings } from "../../src/api/holdings";
import { extractErrorMessage } from "../../src/api/client";
import { useTheme } from "../../src/context/ThemeContext";
import { useAuth } from "../../src/context/AuthContext";
import { spacing, radius } from "../../src/theme/colors";
import {
  formatToman,
  formatRelativeTime,
  formatDateTime,
  formatTomanShort,
} from "../../src/utils/format";
import { HoldingItem } from "../../src/api/types";

const CATEGORY_LABELS: Record<string, string> = {
  coin: "سکه",
  fund: "صندوق طلا",
  currency: "ارز",
  crypto: "رمزارز",
  manual: "سایر دارایی‌ها",
};
const CATEGORY_ORDER = ["coin", "fund", "currency", "crypto", "manual"];

// نرخ دلار به تومان — برای نشون دادن معادل دلاری رمزارزها
const USD_ASSET_KEY = "currency_usd";

function groupByCategory(items: HoldingItem[]) {
  const groups = new Map<string, HoldingItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c] ?? c,
    items: groups.get(c)!,
  }));
}

export default function DashboardScreen() {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["holdings-summary"],
    queryFn: fetchHoldingsSummary,
  });

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const dirtyRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // وقتی داده‌ی سرور اومد، فرم رو با تعداد ذخیره‌شده‌ی قبلی کاربر پر کن -
  // ولی فقط اگه کاربر همین الان در حال ویرایش نیست (تا ادیت‌های نشسته پاک نشه)
  useEffect(() => {
    if (data && !dirtyRef.current) {
      const initial: Record<string, string> = {};
      for (const item of data.items) {
        initial[item.assetKey] =
          item.quantity > 0 ? String(item.quantity) : "";
      }
      setQuantities(initial);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(quantities).map(([assetKey, qty]) => ({
        assetKey,
        quantity: Number(qty) || 0,
      }));
      return saveHoldings(items);
    },
    onSuccess: async () => {
      dirtyRef.current = false;
      setSaveError(null);
      setSavedAt(Date.now());
      await queryClient.invalidateQueries({ queryKey: ["holdings-summary"] });
    },
    onError: (err) => setSaveError(extractErrorMessage(err)),
  });

  function handleChangeQuantity(assetKey: string, value: string) {
    dirtyRef.current = true;
    const sanitized = value.replace(/[^0-9.]/g, "");
    setQuantities((prev) => ({ ...prev, [assetKey]: sanitized }));
  }

  const items: HoldingItem[] = data?.items ?? [];

  const liveTotal = items.reduce((sum: number, item: HoldingItem) => {
    const qty = Number(quantities[item.assetKey]) || 0;
    return sum + qty * (item.price ?? 0);
  }, 0);

  // ترکیب دارایی‌ها برای نمودار — فقط آیتم‌هایی که واقعاً ارزش دارن
  const chartSlices: DonutSlice[] = useMemo(
    () =>
      items
        .map((item) => ({
          key: item.assetKey,
          label: item.label,
          value: (Number(quantities[item.assetKey]) || 0) * (item.price ?? 0),
        }))
        .filter((s) => s.value > 0),
    [items, quantities]
  );

  const lastUpdate = items
    .map((i: HoldingItem) => i.priceUpdatedAt)
    .filter(Boolean)
    .sort()
    .pop();

  const grouped = groupByCategory(items);
  const ownedCount = chartSlices.length;

  // نرخ دلار برای تبدیل قیمت رمزارزها به دلار در نمایش
  const usdRate =
    items.find((i) => i.assetKey === USD_ASSET_KEY)?.price ?? null;
  const greeting = user?.displayName || user?.username || "خوش آمدید";

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AppText>در حال بارگذاری...</AppText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.gold}
        />
      }
    >
      <AppText style={[styles.greeting, { color: colors.textSecondary }]}>
        سلام {greeting} 👋
      </AppText>

      <View
        style={[
          styles.totalCard,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.gold,
          },
        ]}
      >
        <AppText style={[styles.totalLabel, { color: colors.textSecondary }]}>
          ارزش نقدی لحظه‌ای دارایی‌ها
        </AppText>
        <AppText style={[styles.totalValue, { color: colors.gold }]}>
          {formatToman(liveTotal)}{" "}
          <AppText style={[styles.totalUnit, { color: colors.gold }]}>
            تومان
          </AppText>
        </AppText>
        {liveTotal > 0 ? (
          <AppText style={[styles.totalShort, { color: colors.textSecondary }]}>
            ≈ {formatTomanShort(liveTotal)} تومان
          </AppText>
        ) : null}

        <View style={[styles.updateBadge, { borderColor: colors.border }]}>
          <AppText style={[styles.updateText, { color: colors.textSecondary }]}>
            🕒 آخرین به‌روزرسانی قیمت: {formatRelativeTime(lastUpdate)}
          </AppText>
          <AppText style={[styles.updateExact, { color: colors.textMuted }]}>
            {formatDateTime(lastUpdate)}
          </AppText>
        </View>
      </View>

      {error ? (
        <AppText style={[styles.errorBanner, { color: colors.danger }]}>
          {extractErrorMessage(error)}
        </AppText>
      ) : null}

      {chartSlices.length > 0 ? (
        <Card style={styles.groupCard}>
          <AppText style={[styles.groupTitle, { color: colors.goldSoft }]}>
            ترکیب دارایی‌ها
          </AppText>
          <DonutChart slices={chartSlices} />
        </Card>
      ) : (
        <Card style={[styles.groupCard, styles.emptyCard]}>
          <AppText style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            هنوز دارایی‌ای ثبت نکرده‌اید
          </AppText>
          <AppText style={[styles.emptyText, { color: colors.textSecondary }]}>
            تعداد سکه یا واحد صندوق‌هایتان را در فهرست پایین وارد کنید تا ارزش
            لحظه‌ای و نمودار ترکیب دارایی‌هایتان را ببینید.
          </AppText>
        </Card>
      )}

      {grouped.map((group) => (
        <Card key={group.category} style={styles.groupCard}>
          <AppText style={[styles.groupTitle, { color: colors.goldSoft }]}>
            {group.label}
          </AppText>
          {group.items.map((item) => (
            <AssetRow
              key={item.assetKey}
              item={item}
              quantity={quantities[item.assetKey] ?? ""}
              onChangeQuantity={handleChangeQuantity}
              usdRate={group.category === "crypto" ? usdRate : null}
            />
          ))}
        </Card>
      ))}

      {saveError ? (
        <AppText style={[styles.errorBanner, { color: colors.danger }]}>
          {saveError}
        </AppText>
      ) : null}

      {savedAt && !saveMutation.isPending && !saveError ? (
        <AppText style={[styles.successBanner, { color: colors.success }]}>
          ✓ دارایی‌های شما ذخیره شد ({ownedCount} مورد)
        </AppText>
      ) : null}

      <PrimaryButton
        title="ذخیره و محاسبه"
        onPress={() => saveMutation.mutate()}
        loading={saveMutation.isPending}
        style={styles.saveButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  greeting: {
    fontSize: 14,
    textAlign: "right",
    marginBottom: spacing.sm,
  },
  totalCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: "flex-end",
  },
  totalLabel: { fontSize: 13 },
  totalValue: {
    fontSize: 30,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  totalUnit: { fontSize: 15, fontWeight: "600" },
  totalShort: { fontSize: 12, marginTop: 2 },
  updateBadge: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  updateText: { fontSize: 12 },
  updateExact: { fontSize: 11, marginTop: 2 },
  groupCard: { marginBottom: spacing.md },
  groupTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: spacing.sm,
    textAlign: "right",
  },
  emptyCard: { alignItems: "flex-end", gap: spacing.xs },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  emptyText: { fontSize: 13, lineHeight: 21, textAlign: "right" },
  saveButton: { marginTop: spacing.sm },
  errorBanner: {
    textAlign: "right",
    marginBottom: spacing.md,
  },
  successBanner: {
    textAlign: "right",
    marginBottom: spacing.md,
    fontSize: 13,
  },
});
