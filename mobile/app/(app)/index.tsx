import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppText } from "../../src/components/AppText";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { AssetRow } from "../../src/components/AssetRow";
import { fetchHoldingsSummary, saveHoldings } from "../../src/api/holdings";
import { extractErrorMessage } from "../../src/api/client";
import { colors, spacing, radius } from "../../src/theme/colors";
import { formatToman, formatRelativeTime } from "../../src/utils/format";
import { HoldingItem } from "../../src/api/types";

const CATEGORY_LABELS: Record<string, string> = {
  coin: "سکه",
  fund: "صندوق طلا",
  manual: "سایر دارایی‌ها",
};
const CATEGORY_ORDER = ["coin", "fund", "manual"];

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
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["holdings-summary"],
    queryFn: fetchHoldingsSummary,
  });

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const dirtyRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const lastUpdate = items
    .map((i: HoldingItem) => i.priceUpdatedAt)
    .filter(Boolean)
    .sort()
    .pop();

  const grouped = groupByCategory(items);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <AppText>در حال بارگذاری...</AppText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.gold}
        />
      }
    >
      <AppText style={styles.title}>دارایی من</AppText>

      <View style={styles.totalCard}>
        <AppText style={styles.totalLabel}>ارزش نقدی لحظه‌ای دارایی‌ها</AppText>
        <AppText style={styles.totalValue}>
          {formatToman(liveTotal)} <AppText style={styles.totalUnit}>تومان</AppText>
        </AppText>
        <AppText style={styles.totalMeta}>
          آخرین به‌روزرسانی قیمت: {formatRelativeTime(lastUpdate)}
        </AppText>
      </View>

      {error ? (
        <AppText style={styles.errorBanner}>{extractErrorMessage(error)}</AppText>
      ) : null}

      {grouped.map((group) => (
        <Card key={group.category} style={styles.groupCard}>
          <AppText style={styles.groupTitle}>{group.label}</AppText>
          {group.items.map((item) => (
            <AssetRow
              key={item.assetKey}
              item={item}
              quantity={quantities[item.assetKey] ?? ""}
              onChangeQuantity={handleChangeQuantity}
            />
          ))}
        </Card>
      ))}

      {saveError ? (
        <AppText style={styles.errorBanner}>{saveError}</AppText>
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
  flex: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  container: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: spacing.md,
  },
  totalCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: "flex-end",
  },
  totalLabel: { color: colors.textSecondary, fontSize: 13 },
  totalValue: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  totalUnit: { fontSize: 15, fontWeight: "600" },
  totalMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  groupCard: { marginBottom: spacing.md },
  groupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.goldSoft,
    marginBottom: spacing.sm,
    textAlign: "right",
  },
  saveButton: { marginTop: spacing.sm },
  errorBanner: {
    color: colors.danger,
    textAlign: "right",
    marginBottom: spacing.md,
  },
});
