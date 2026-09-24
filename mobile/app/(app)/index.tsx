import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  AppState,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { AppText } from "../../src/components/AppText";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { AssetRow } from "../../src/components/AssetRow";
import { DonutChart, DonutSlice } from "../../src/components/DonutChart";
import { LineChart } from "../../src/components/LineChart";
import { fetchAssetHistory } from "../../src/api/prices";
import { useHoldings } from "../../src/hooks/useHoldings";
import { LocalHoldings } from "../../src/storage/holdings";
import { buildPortfolioHistory } from "../../src/utils/portfolioHistory";
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
import { fetchMarket } from "../../src/api/market";
import {
  computeIntrinsic,
  intrinsicSymbolForAsset,
  IntrinsicPrice,
} from "../../src/utils/intrinsic";

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

/**
 * ذخیره‌ی خودکار — روی خود دستگاه.
 *
 * دارایی‌ها دیگر به سرور نمی‌روند (بخش «ذخیره‌سازی محلی» در src/storage/
 * holdings.ts)، پس ذخیره یعنی یک نوشتن در حافظه‌ی گوشی. تأخیر کوتاهی می‌ماند
 * تا با هر ضربه‌ی کیبورد دیسک و نمودار روند دوباره حساب نشوند، و موقع رفتن اپ
 * به پس‌زمینه یا خروج از صفحه بی‌درنگ خالی می‌شود.
 */
const AUTOSAVE_DELAY = 800;

type HoldingsForm = {
  quantities: Record<string, string>;
  buyPrices: Record<string, string>;
};

/**
 * فرمِ رشته‌ای → چیزی که ذخیره می‌شود.
 * رشته‌ی خالی و صفر هر دو یعنی «ثبت نشده»؛ صفر به‌عنوان قیمت خرید یعنی
 * «مجانی گرفتم» که سود کل را خراب می‌کند.
 */
function formToHoldings(form: HoldingsForm): LocalHoldings {
  const keys = new Set([
    ...Object.keys(form.quantities),
    ...Object.keys(form.buyPrices),
  ]);
  const out: LocalHoldings = {};
  for (const key of keys) {
    const quantity = Number(form.quantities[key]) || 0;
    const buy = Number(form.buyPrices[key]) || 0;
    if (quantity <= 0 && buy <= 0) continue;
    out[key] = {
      quantity: quantity > 0 ? quantity : 0,
      avgBuyPrice: buy > 0 ? buy : null,
    };
  }
  return out;
}

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
 * عددها از دارایی‌های *ذخیره‌شده* می‌آیند، نه از مقادیری که همین الان در فرم
 * تایپ شده — یعنی بعد از نشستن ذخیره‌ی خودکار تازه می‌شود.
 *
 * محاسبه‌اش روی خود گوشی انجام می‌شود (buildPortfolioHistory) چون سرور دیگر
 * نمی‌داند کاربر چه چیزی دارد؛ فقط تاریخچه‌ی عمومیِ قیمت هر دارایی را می‌دهد.
 */
function PortfolioTrendCard({ items }: { items: HoldingItem[] }) {
  const { colors } = useTheme();
  const [days, setDays] = useState(30);

  const owned = useMemo(() => items.filter((i) => i.quantity > 0), [items]);
  // تعدادها داخل کلید می‌آیند تا با عوض شدنشان نمودار دوباره حساب شود
  const signature = useMemo(
    () =>
      owned
        .map((i) => `${i.assetKey}:${i.quantity}`)
        .sort()
        .join("|"),
    [owned]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["portfolio-history", signature, days],
    queryFn: () => buildPortfolioHistory(owned, days),
    enabled: owned.length > 0,
    staleTime: 10 * 60_000,
  });

  if (owned.length === 0) return null;

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
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    items,
    save,
    isLoading,
    isRefetching,
    refetch,
    error,
    ready,
  } = useHoldings();

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [buyPrices, setBuyPrices] = useState<Record<string, string>>({});
  const dirtyRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");
  const [trendAsset, setTrendAsset] = useState<HoldingItem | null>(null);
  const [exporting, setExporting] = useState(false);

  // مقدارِ لحظه‌ای فرم برای تایمرها و لیسنرها — از state خوانده نمی‌شود چون
  // closureشان کهنه می‌ماند و ذخیره‌ی خودکار مقدار قدیمی را می‌نوشت.
  const formRef = useRef<HoldingsForm>({ quantities: {}, buyPrices: {} });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // فرم فقط یک‌بار از روی مقادیر ذخیره‌شده پر می‌شود؛ بعد از آن تازه شدن
  // قیمت‌ها نباید چیزی را که کاربر تایپ کرده پاک کند.
  const hydratedRef = useRef(false);

  const flushSave = useCallback(
    async (force = false) => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      if (!force && !dirtyRef.current) return;

      setSaveState("saving");
      try {
        await save(formToHoldings(formRef.current));
        dirtyRef.current = false;
        setSaveError(null);
        setSavedAt(Date.now());
        setSaveState("saved");
      } catch {
        setSaveError("ذخیره‌ی دارایی‌ها روی این دستگاه ممکن نشد.");
        setSaveState("error");
      }
    },
    [save]
  );

  // پر کردن فرم از روی دارایی‌های ذخیره‌شده‌ی دستگاه (که شامل مهاجرتِ
  // یک‌باره‌ی داده‌ی قدیمیِ سرور هم هست).
  useEffect(() => {
    if (!ready || hydratedRef.current || dirtyRef.current) return;

    const nextQty: Record<string, string> = {};
    const nextBuy: Record<string, string> = {};
    for (const item of items) {
      nextQty[item.assetKey] = item.quantity > 0 ? String(item.quantity) : "";
      nextBuy[item.assetKey] =
        item.avgBuyPrice && item.avgBuyPrice > 0 ? String(item.avgBuyPrice) : "";
    }

    formRef.current = { quantities: nextQty, buyPrices: nextBuy };
    setQuantities(nextQty);
    setBuyPrices(nextBuy);
    hydratedRef.current = true;
  }, [ready, items]);

  // رفتن اپ به پس‌زمینه یا ترک صفحه = آخرین فرصت برای ذخیره‌ی چیزی که تایپ شده
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active" && dirtyRef.current) void flushSave();
    });
    return () => {
      sub.remove();
      if (dirtyRef.current) void flushSave();
    };
  }, [flushSave]);

  useEffect(
    () => () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    },
    []
  );

  function markEdited(next: HoldingsForm) {
    dirtyRef.current = true;
    formRef.current = next;
    setSaveState("dirty");

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void flushSave();
    }, AUTOSAVE_DELAY);
  }

  // ورودی از راه sanitizeNumericInput رد می‌شه چون صفحه‌کلید فارسی ارقام
  // فارسی می‌فرسته و فیلتر ساده‌ی [^0-9.] همه‌شون رو پاک می‌کرد.
  function handleChangeQuantity(assetKey: string, value: string) {
    const next: HoldingsForm = {
      quantities: {
        ...formRef.current.quantities,
        [assetKey]: sanitizeNumericInput(value),
      },
      buyPrices: formRef.current.buyPrices,
    };
    setQuantities(next.quantities);
    markEdited(next);
  }

  function handleChangeBuyPrice(assetKey: string, value: string) {
    const next: HoldingsForm = {
      quantities: formRef.current.quantities,
      buyPrices: {
        ...formRef.current.buyPrices,
        [assetKey]: sanitizeNumericInput(value),
      },
    };
    setBuyPrices(next.buyPrices);
    markEdited(next);
  }

  // فهرست بازار فقط برای انس جهانی و دلارِ قیمت محاسباتی لازم است. همان
  // queryKey تب «قیمت‌ها» است، پس اگر کاربر آن تب را باز کرده باشد از کش
  // خوانده می‌شود و درخواست تازه‌ای نمی‌رود. خطایش هم بی‌اهمیت است: بدون آن
  // فقط بخش حباب رندر نمی‌شود.
  const { data: market } = useQuery({
    queryKey: ["market"],
    queryFn: fetchMarket,
    staleTime: 60_000,
  });

  const intrinsicByAsset = useMemo(() => {
    const map: Record<string, IntrinsicPrice> = {};
    if (!market?.items) return map;
    for (const item of items) {
      const symbol = intrinsicSymbolForAsset(item.assetKey);
      if (!symbol) continue;
      const value = computeIntrinsic(symbol, market.items, item.price);
      if (value) map[item.assetKey] = value;
    }
    return map;
  }, [items, market]);

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

      {/* از دارایی‌های ذخیره‌شده تغذیه می‌شود نه از فرم، وگرنه با هر رقمی که
          تایپ می‌شود نمودار از نو حساب می‌شد. */}
      <PortfolioTrendCard items={items} />

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
              intrinsic={intrinsicByAsset[item.assetKey]}
            />
          ))}
        </Card>
      ))}

      {saveError ? (
        <AppText style={[styles.errorBanner, { color: colors.danger }]}>
          {saveError}
        </AppText>
      ) : null}

      {saveState === "saving" ? (
        <AppText style={[styles.successBanner, { color: colors.textSecondary }]}>
          در حال ذخیره‌ی خودکار…
        </AppText>
      ) : saveState === "dirty" ? (
        <AppText style={[styles.successBanner, { color: colors.textMuted }]}>
          تغییرات شما تا لحظاتی دیگر خودکار ذخیره می‌شود…
        </AppText>
      ) : savedAt && !saveError ? (
        <AppText style={[styles.successBanner, { color: colors.success }]}>
          ✓ دارایی‌های شما ذخیره شد ({ownedCount} مورد)
        </AppText>
      ) : null}

      <PrimaryButton
        title="ذخیره و محاسبه"
        onPress={() => flushSave(true)}
        loading={saveState === "saving"}
        style={styles.saveButton}
      />
      <AppText style={[styles.chartHint, { color: colors.textMuted }]}>
        نیازی به زدن این دکمه نیست؛ تعدادها خودکار ذخیره می‌شوند.
      </AppText>

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
