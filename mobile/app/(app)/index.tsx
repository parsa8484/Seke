import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { AppText } from "../../src/components/AppText";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { AssetRow } from "../../src/components/AssetRow";
import { DonutChart, DonutSlice } from "../../src/components/DonutChart";
import { LineChart } from "../../src/components/LineChart";
import {
  fetchHoldingsSummary,
  saveHoldings,
  fetchAssetHistory,
  fetchPortfolioHistory,
} from "../../src/api/holdings";
import {
  buildHoldingsCsv,
  holdingsCsvBaseName,
  CsvHoldingRow,
} from "../../src/utils/csv";
import { saveTextFile } from "../../src/utils/exportFile";
import { extractErrorMessage } from "../../src/api/client";
import { useTheme } from "../../src/context/ThemeContext";
import { useAuth } from "../../src/context/AuthContext";
import { spacing, radius } from "../../src/theme/colors";
import {
  formatToman,
  formatRelativeTime,
  formatDateTime,
  formatTomanShort,
  formatPercent,
  formatSignedToman,
  sanitizeNumericInput,
} from "../../src/utils/format";
import { HoldingItem } from "../../src/api/types";

const CATEGORY_LABELS: Record<string, string> = {
  coin: "سکه",
  gold: "طلا و نقره",
  fund: "صندوق طلا",
  currency: "ارز",
  crypto: "رمزارز",
  manual: "سایر دارایی‌ها",
};
const CATEGORY_ORDER = ["coin", "gold", "fund", "currency", "crypto", "manual"];

// نرخ دلار به تومان — برای نشون دادن معادل دلاری رمزارزها
const USD_ASSET_KEY = "currency_usd";

function groupByCategory(items: HoldingItem[]) {
  const groups = new Map<string, HoldingItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  // دسته‌های ناشناخته (که ادمین ساخته) هم باید دیده بشن، وگرنه بی‌صدا گم می‌شن
  const known = CATEGORY_ORDER.filter((c) => groups.has(c));
  const unknown = [...groups.keys()].filter((c) => !CATEGORY_ORDER.includes(c));
  return [...known, ...unknown].map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c] ?? c,
    items: groups.get(c)!,
  }));
}

const RANGE_OPTIONS = [
  { days: 7, label: "۱ هفته" },
  { days: 30, label: "۱ ماه" },
  { days: 90, label: "۳ ماه" },
  { days: 365, label: "۱ سال" },
];

/** انتخاب بازه‌ی زمانی نمودار — هم برای روند یک دارایی، هم برای کل پرتفوی */
function RangeChips({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.rangeRow}>
      {RANGE_OPTIONS.map((option) => {
        const active = value === option.days;
        return (
          <Pressable
            key={option.days}
            onPress={() => onChange(option.days)}
            style={[
              styles.rangeChip,
              {
                borderColor: active ? colors.gold : colors.border,
                backgroundColor: active ? colors.surfaceElevated : "transparent",
              },
            ]}
          >
            <AppText
              style={[
                styles.rangeText,
                { color: active ? colors.gold : colors.textSecondary },
              ]}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * روند ارزش کل پرتفوی.
 *
 * عددها از دارایی‌های *ذخیره‌شده* روی سرور می‌آیند، نه از مقادیری که همین الان
 * در فرم تایپ شده — پس بعد از «ذخیره و محاسبه» تازه می‌شود.
 */
function PortfolioTrendCard({ enabled }: { enabled: boolean }) {
  const { colors } = useTheme();
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portfolio-history", days],
    queryFn: () => fetchPortfolioHistory(days),
    enabled,
    staleTime: 10 * 60_000,
  });

  if (!enabled) return null;

  const missing = data?.missingHistory ?? [];

  return (
    <Card style={styles.groupCard}>
      <AppText style={[styles.groupTitle, { color: colors.goldSoft }]}>
        روند ارزش دارایی‌ها
      </AppText>

      <RangeChips value={days} onChange={setDays} />

      {isLoading ? (
        <View style={styles.modalLoading}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <AppText style={[styles.errorBanner, { color: colors.danger }]}>
          {extractErrorMessage(error)}
        </AppText>
      ) : (
        <LineChart points={data?.points ?? []} height={200} />
      )}

      <AppText style={[styles.chartHint, { color: colors.textMuted }]}>
        بر اساس تعداد دارایی‌های ذخیره‌شده‌ی فعلی و قیمت هر روز محاسبه می‌شود.
      </AppText>
      {missing.length > 0 ? (
        <AppText style={[styles.chartHint, { color: colors.textMuted }]}>
          برای {missing.join("، ")} تاریخچه‌ای موجود نبود و با قیمت امروز ثابت
          در نظر گرفته شده.
        </AppText>
      ) : null}
    </Card>
  );
}

/** پنجره‌ی نمودار روند یک دارایی */
function TrendModal({
  assetKey,
  label,
  onClose,
}: {
  assetKey: string | null;
  label: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ["asset-history", assetKey, days],
    queryFn: () => fetchAssetHistory(assetKey!, days),
    enabled: Boolean(assetKey),
    staleTime: 10 * 60_000,
  });

  return (
    <Modal
      visible={Boolean(assetKey)}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.modalSheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <AppText style={[styles.modalTitle, { color: colors.textPrimary }]}>
            روند قیمت {label}
          </AppText>

          <RangeChips value={days} onChange={setDays} />

          {isLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : error ? (
            <AppText style={[styles.errorBanner, { color: colors.danger }]}>
              {extractErrorMessage(error)}
            </AppText>
          ) : (
            <LineChart points={data?.points ?? []} />
          )}

          <PrimaryButton title="بستن" onPress={onClose} variant="outline" />
        </Pressable>
      </Pressable>
    </Modal>
  );
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
  const [buyPrices, setBuyPrices] = useState<Record<string, string>>({});
  const dirtyRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [trendAsset, setTrendAsset] = useState<HoldingItem | null>(null);
  const [exporting, setExporting] = useState(false);

  // وقتی داده‌ی سرور اومد، فرم رو با تعداد ذخیره‌شده‌ی قبلی کاربر پر کن -
  // ولی فقط اگه کاربر همین الان در حال ویرایش نیست (تا ادیت‌های نشسته پاک نشه)
  useEffect(() => {
    if (data && !dirtyRef.current) {
      const initialQty: Record<string, string> = {};
      const initialBuy: Record<string, string> = {};
      for (const item of data.items) {
        initialQty[item.assetKey] = item.quantity > 0 ? String(item.quantity) : "";
        initialBuy[item.assetKey] =
          item.avgBuyPrice && item.avgBuyPrice > 0
            ? String(item.avgBuyPrice)
            : "";
      }
      setQuantities(initialQty);
      setBuyPrices(initialBuy);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(quantities).map(([assetKey, qty]) => ({
        assetKey,
        quantity: Number(qty) || 0,
        // رشته‌ی خالی → null یعنی «قیمت خرید ثبت نشده»، نه صفر
        avgBuyPrice: buyPrices[assetKey]?.trim()
          ? Number(buyPrices[assetKey]) || null
          : null,
      }));
      return saveHoldings(items);
    },
    onSuccess: async () => {
      dirtyRef.current = false;
      setSaveError(null);
      setSavedAt(Date.now());
      await queryClient.invalidateQueries({ queryKey: ["holdings-summary"] });
      // نمودار روند از دارایی‌های ذخیره‌شده می‌خواند، پس باید دوباره گرفته شود
      await queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
    },
    onError: (err) => setSaveError(extractErrorMessage(err)),
  });

  // ورودی از راه sanitizeNumericInput رد می‌شه چون صفحه‌کلید فارسی ارقام
  // فارسی می‌فرسته و فیلتر ساده‌ی [^0-9.] همه‌شون رو پاک می‌کرد.
  function handleChangeQuantity(assetKey: string, value: string) {
    dirtyRef.current = true;
    setQuantities((prev) => ({ ...prev, [assetKey]: sanitizeNumericInput(value) }));
  }

  function handleChangeBuyPrice(assetKey: string, value: string) {
    dirtyRef.current = true;
    setBuyPrices((prev) => ({ ...prev, [assetKey]: sanitizeNumericInput(value) }));
  }

  const items: HoldingItem[] = data?.items ?? [];

  // همه‌ی محاسبه‌ها روی مقادیر در حال ویرایش انجام می‌شه (نه مقادیر ذخیره‌شده)
  // تا کاربر نتیجه رو قبل از زدن «ذخیره» ببینه.
  const live = useMemo(() => {
    let total = 0;
    let cost = 0;
    let valueWithCost = 0;

    for (const item of items) {
      const qty = Number(quantities[item.assetKey]) || 0;
      const buy = Number(buyPrices[item.assetKey]) || 0;
      const value = qty * (item.price ?? 0);
      total += value;
      if (qty > 0 && buy > 0 && item.price !== null) {
        cost += buy * qty;
        valueWithCost += value;
      }
    }

    const profit = cost > 0 ? valueWithCost - cost : null;
    return {
      total,
      cost: cost > 0 ? cost : null,
      profit,
      profitPercent: cost > 0 && profit !== null ? (profit / cost) * 100 : null,
    };
  }, [items, quantities, buyPrices]);

  // خروجی CSV از همان چیزی که روی صفحه است (مقادیر در حال ویرایش، نه فقط
  // ذخیره‌شده‌ها) تا خروجی با عددهایی که کاربر می‌بیند بخواند.
  async function handleExport() {
    const rows: CsvHoldingRow[] = items
      .map((item) => {
        const quantity = Number(quantities[item.assetKey]) || 0;
        const buy = Number(buyPrices[item.assetKey]) || 0;
        const price = item.price;
        const value = quantity * (price ?? 0);
        const cost = quantity > 0 && buy > 0 && price !== null ? buy * quantity : null;
        const profit = cost !== null ? value - cost : null;
        return {
          label: item.label,
          categoryLabel: CATEGORY_LABELS[item.category] ?? item.category,
          unit: item.unit,
          quantity,
          avgBuyPrice: buy > 0 ? buy : null,
          price,
          value,
          profit,
          profitPercent:
            cost !== null && cost > 0 && profit !== null ? (profit / cost) * 100 : null,
        };
      })
      .filter((r) => r.quantity > 0);

    if (rows.length === 0) {
      Alert.alert(
        "خروجی گرفتن",
        "هنوز دارایی‌ای با تعداد بیشتر از صفر ثبت نکرده‌اید."
      );
      return;
    }

    setExporting(true);
    try {
      const csv = buildHoldingsCsv(rows, live);
      const baseName = holdingsCsvBaseName();
      const result = await saveTextFile(baseName, "text/csv", csv);

      if (result.status === "saved") {
        Alert.alert(
          "ذخیره شد",
          `فایل «${baseName}.csv» با ${rows.length} دارایی در «${result.location}» ذخیره شد.`
        );
      } else if (result.status === "shared") {
        Alert.alert("آماده شد", "خروجی برای اشتراک‌گذاری ارسال شد.");
      }
    } catch {
      Alert.alert("خطا", "ساخت فایل خروجی ممکن نشد.");
    } finally {
      setExporting(false);
    }
  }

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

  const profitColor =
    live.profit === null
      ? colors.textMuted
      : live.profit > 0
      ? colors.success
      : live.profit < 0
      ? colors.danger
      : colors.textMuted;

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
          {formatToman(live.total)}{" "}
          <AppText style={[styles.totalUnit, { color: colors.gold }]}>
            تومان
          </AppText>
        </AppText>
        {live.total > 0 ? (
          <AppText style={[styles.totalShort, { color: colors.textSecondary }]}>
            ≈ {formatTomanShort(live.total)} تومان
          </AppText>
        ) : null}

        <View style={[styles.updateBadge, { borderColor: colors.border }]}>
          <AppText style={[styles.updateText, { color: colors.textSecondary }]}>
            🕒 آخرین به‌روزرسانی قیمت: {formatRelativeTime(lastUpdate)}
          </AppText>
          <AppText style={[styles.updateExact, { color: colors.textMuted }]}>
            {formatDateTime(lastUpdate)} · منبع قیمت‌ها: tgju.org
          </AppText>
        </View>
      </View>

      {/* سود/زیان کل — فقط وقتی حداقل یک قیمت خرید ثبت شده باشه */}
      {live.profit !== null ? (
        <Card style={styles.profitCard}>
          <AppText style={[styles.profitTitle, { color: colors.textSecondary }]}>
            سود / زیان کل
          </AppText>
          <AppText style={[styles.profitValue, { color: profitColor }]}>
            {formatSignedToman(live.profit)} تومان
          </AppText>
          <AppText style={[styles.profitPercent, { color: profitColor }]}>
            {formatPercent(live.profitPercent)} نسبت به بهای خرید
          </AppText>
          <AppText style={[styles.profitCost, { color: colors.textMuted }]}>
            بهای خرید: {formatToman(live.cost)} تومان
          </AppText>
        </Card>
      ) : (
        <Card style={styles.profitCard}>
          <AppText style={[styles.profitTitle, { color: colors.textSecondary }]}>
            سود / زیان
          </AppText>
          <AppText style={[styles.profitHint, { color: colors.textMuted }]}>
            برای دیدن سود یا زیان، زیر هر دارایی «قیمت خرید هر واحد» را وارد
            کنید. بدون قیمت خرید نمی‌شود سود را حساب کرد.
          </AppText>
        </Card>
      )}

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

      {/* شرط را از داده‌ی ذخیره‌شده می‌گیریم نه فرم، چون نمودار هم از همان
          می‌آید و گرنه به‌محض تایپ یک عدد، کارتِ خالی ظاهر می‌شد. */}
      <PortfolioTrendCard enabled={items.some((i) => i.quantity > 0)} />

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
              buyPrice={buyPrices[item.assetKey] ?? ""}
              onChangeQuantity={handleChangeQuantity}
              onChangeBuyPrice={handleChangeBuyPrice}
              onPressChart={() => setTrendAsset(item)}
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

      <PrimaryButton
        title="🔔 هشدارهای قیمت"
        onPress={() => router.push("/(app)/alerts")}
        variant="outline"
        style={styles.alertsButton}
      />

      <PrimaryButton
        title="📤 خروجی اکسل (CSV)"
        onPress={handleExport}
        loading={exporting}
        variant="outline"
        style={styles.alertsButton}
      />

      <TrendModal
        assetKey={trendAsset?.assetKey ?? null}
        label={trendAsset?.label ?? ""}
        onClose={() => setTrendAsset(null)}
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
  profitCard: { marginBottom: spacing.md, alignItems: "flex-end" },
  profitTitle: { fontSize: 13 },
  profitValue: { fontSize: 24, fontWeight: "800", marginTop: 2 },
  profitPercent: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  profitCost: { fontSize: 11, marginTop: spacing.xs },
  profitHint: { fontSize: 12, lineHeight: 20, textAlign: "right", marginTop: 4 },
  groupCard: { marginBottom: spacing.md },
  chartHint: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: "right",
    marginTop: spacing.xs,
  },
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
  alertsButton: { marginTop: spacing.sm },
  errorBanner: {
    textAlign: "right",
    marginBottom: spacing.md,
  },
  successBanner: {
    textAlign: "right",
    marginBottom: spacing.md,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", textAlign: "right" },
  modalLoading: { height: 180, alignItems: "center", justifyContent: "center" },
  rangeRow: { flexDirection: "row-reverse", gap: spacing.xs },
  rangeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    alignItems: "center",
  },
  rangeText: { fontSize: 12, fontWeight: "600" },
});
