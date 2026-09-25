import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { AppText } from "../../../src/components/AppText";
import { Card } from "../../../src/components/Card";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import {
  createAlert,
  deleteAlert,
  fetchAlerts,
  updateAlert,
} from "../../../src/api/alerts";
import { useHoldings } from "../../../src/hooks/useHoldings";
import { extractErrorMessage } from "../../../src/api/client";
import { registerForPushNotifications } from "../../../src/services/notifications";
import { useTheme } from "../../../src/context/ThemeContext";
import { AppColors, radius, spacing } from "../../../src/theme/colors";
import {
  formatToman,
  formatJalaliDateTime,
  sanitizeNumericInput,
} from "../../../src/utils/format";
import {
  AlertDirection,
  HoldingItem,
  PriceAlert,
} from "../../../src/api/types";

/**
 * پیشنهادِ قیمت هدف: ۲٪ آن‌طرفِ قیمت فعلی، گرد شده به عددی تمیز.
 *
 * قبلاً دقیقاً خودِ قیمت فعلی پیش‌فرض می‌شد؛ اگر کاربر دست‌نخورده می‌فرستاد،
 * هشداری ساخته می‌شد که شرطش از همان لحظه برقرار بود و در اولین رفرشِ سرور
 * بی‌دلیل شلیک می‌کرد.
 */
function suggestTarget(price: number, direction: AlertDirection): string {
  const raw = direction === "above" ? price * 1.02 : price * 0.98;
  const step =
    raw >= 1_000_000
      ? 10_000
      : raw >= 100_000
      ? 1_000
      : raw >= 10_000
      ? 100
      : raw >= 100
      ? 10
      : 0;
  // قیمت‌های خیلی کوچک (واحد صندوق) را گرد نمی‌کنیم؛ گرد کردن ممکن است
  // عدد را به آن‌طرفِ اشتباهِ قیمت فعلی ببرد
  if (step === 0) return String(Number(raw.toFixed(2)));
  const rounded =
    direction === "above"
      ? Math.ceil(raw / step) * step
      : Math.floor(raw / step) * step;
  return String(rounded);
}

export default function AlertsScreen() {
  const { colors } = useTheme();
  const styles2 = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [assetKey, setAssetKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [target, setTarget] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  // آخرین عددی که خودمان پیشنهاد داده‌ایم؛ تا وقتی کاربر دستش نزده با عوض
  // شدن شرط دوباره پیشنهاد می‌دهیم، بعد از آن دیگر کاری به عددش نداریم.
  const suggestedRef = useRef<string | null>(null);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
  });
  const { items } = useHoldings();

  // فقط دارایی‌هایی که قیمت آنلاین دارن قابل هشدار گذاشتنن
  const assets = useMemo<HoldingItem[]>(
    () => items.filter((i: HoldingItem) => i.price !== null),
    [items]
  );

  // ثبت توکن پوش همون بار اولی که کاربر وارد این صفحه می‌شه
  useEffect(() => {
    registerForPushNotifications().then((r) => setPushError(r.error));
  }, []);

  const selected =
    assets.find((a: HoldingItem) => a.assetKey === assetKey) ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      createAlert({
        assetKey: assetKey!,
        direction,
        targetPrice: Number(target),
      }),
    onSuccess: async () => {
      setTarget("");
      suggestedRef.current = null;
      setAssetKey(null);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err) => setFormError(extractErrorMessage(err)),
  });

  // خطای این دو تا قبلاً بی‌صدا بلعیده می‌شد: کاربر دکمه رو می‌زد و هیچ اتفاقی
  // نمی‌افتاد بدون اینکه بفهمه چرا.
  const toggleMutation = useMutation({
    mutationFn: (alert: PriceAlert) =>
      updateAlert(alert.id, { isActive: !alert.isActive }),
    onSuccess: () => {
      setListError(null);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err) => setListError(extractErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlert(id),
    onSuccess: () => {
      setListError(null);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err) => setListError(extractErrorMessage(err)),
  });

  /** تا وقتی عددِ داخل کادر همان چیزی است که خودمان گذاشته‌ایم، جای تغییر دارد */
  function applySuggestion(price: number | null, dir: AlertDirection) {
    if (!price) return;
    if (target && target !== suggestedRef.current) return;
    const next = suggestTarget(price, dir);
    suggestedRef.current = next;
    setTarget(next);
  }

  function handleSelectAsset(asset: HoldingItem) {
    setAssetKey(asset.assetKey);
    setFormError(null);
    // عددی نزدیک ولی آن‌طرفِ قیمت فعلی پیشنهاد می‌دهیم تا کاربر مجبور نباشد
    // عددِ ۹ رقمی را از صفر تایپ کند و هدفش هم از پیش محقق نباشد
    applySuggestion(asset.price, direction);
  }

  function handleSelectDirection(next: AlertDirection) {
    setDirection(next);
    setFormError(null);
    applySuggestion(selected?.price ?? null, next);
  }

  function handleCreate() {
    if (!assetKey) return setFormError("اول دارایی را انتخاب کنید");
    const value = Number(target);
    if (!value || value <= 0) return setFormError("قیمت هدف را وارد کنید");
    // همان شرطی که سرور هم رد می‌کند؛ گفتنش اینجا سریع‌تر و روشن‌تر است.
    // هشدار وقتی می‌زند که قیمت از هدف *عبور* کند، پس هدفی که همین حالا
    // محقق است هیچ‌وقت شلیک نمی‌کند.
    const current = selected?.price ?? null;
    if (current !== null) {
      if (direction === "above" && value <= current) {
        return setFormError(
          `قیمت هدف باید بیشتر از قیمت فعلی (${formatToman(current)} تومان) باشد`
        );
      }
      if (direction === "below" && value >= current) {
        return setFormError(
          `قیمت هدف باید کمتر از قیمت فعلی (${formatToman(current)} تومان) باشد`
        );
      }
    }
    setFormError(null);
    createMutation.mutate();
  }

  function confirmDelete(alert: PriceAlert) {
    Alert.alert("حذف هشدار", `هشدار «${alert.label}» حذف شود؟`, [
      { text: "انصراف", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => deleteMutation.mutate(alert.id),
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
      <Pressable
        onPress={() =>
          // اگه این صفحه از روی نوتیفیکیشن مستقیم باز شده باشه، تاریخچه‌ای
          // برای back وجود نداره و دکمه بی‌اثر می‌مونه
          router.canGoBack() ? router.back() : router.replace("/(app)")
        }
        style={styles.backRow}
      >
        <AppText style={[styles.back, { color: colors.gold }]}>بازگشت ›</AppText>
      </Pressable>

      <AppText style={styles.title}>هشدارهای قیمت</AppText>
      <AppText style={[styles.subtitle, { color: colors.textSecondary }]}>
        وقتی قیمت به عددی که می‌خواهید رسید، روی همین گوشی نوتیفیکیشن می‌گیرید.
        هشدار لحظه‌ی عبورِ قیمت از هدف می‌زند، پس هدف باید آن‌طرفِ قیمت فعلی
        باشد.
      </AppText>

      {pushError ? (
        <AppText style={[styles.warning, { color: colors.danger }]}>
          ⚠️ {pushError}
        </AppText>
      ) : null}

      {/* ------------------------- ساخت هشدار جدید ------------------------- */}
      <Card style={styles.section}>
        <AppText style={[styles.sectionTitle, { color: colors.goldSoft }]}>
          هشدار جدید
        </AppText>

        <AppText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          دارایی
        </AppText>
        {/* قبلاً این لیست داخل یک ScrollView افقیِ row-reverse بود؛ اسکرول از
            سمت اشتباه شروع می‌شد و عملاً به چند دارایی‌ی اول نمی‌شد رسید.
            حالا همه‌ی گزینه‌ها در چند سطر و بدون اسکرول دیده می‌شن. */}
        {assets.length === 0 ? (
          <AppText style={[styles.empty, { color: colors.textMuted }]}>
            هنوز قیمتی برای دارایی‌ها دریافت نشده
          </AppText>
        ) : (
          <View style={styles.assetChips}>
            {assets.map((a: HoldingItem) => {
              const active = assetKey === a.assetKey;
              return (
                <Pressable
                  key={a.assetKey}
                  onPress={() => handleSelectAsset(a)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.gold : colors.border,
                      backgroundColor: active
                        ? colors.surfaceElevated
                        : "transparent",
                    },
                  ]}
                >
                  <AppText
                    style={[
                      styles.chipText,
                      { color: active ? colors.gold : colors.textSecondary },
                    ]}
                  >
                    {a.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}

        {selected ? (
          <AppText style={[styles.currentPrice, { color: colors.textMuted }]}>
            قیمت فعلی: {formatToman(selected.price)} تومان
          </AppText>
        ) : null}

        <AppText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          شرط
        </AppText>
        <View style={styles.directionRow}>
          {(
            [
              { value: "above", label: "📈 بالاتر رفت از" },
              { value: "below", label: "📉 پایین‌تر آمد از" },
            ] as const
          ).map((opt) => {
            const active = direction === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleSelectDirection(opt.value)}
                style={[
                  styles.directionOption,
                  {
                    borderColor: active ? colors.gold : colors.border,
                    backgroundColor: active
                      ? colors.surfaceElevated
                      : "transparent",
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.chipText,
                    { color: active ? colors.gold : colors.textSecondary },
                  ]}
                >
                  {opt.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          قیمت هدف (تومان)
        </AppText>
        <TextInput
          value={target}
          onChangeText={(v) => setTarget(sanitizeNumericInput(v))}
          keyboardType="decimal-pad"
          placeholder="مثلاً ۲۰۰۰۰۰۰۰۰"
          placeholderTextColor={colors.textMuted}
          style={styles2.input}
        />
        {target ? (
          <AppText style={[styles.preview, { color: colors.textMuted }]}>
            یعنی {formatToman(Number(target))} تومان
          </AppText>
        ) : null}

        {formError ? (
          <AppText style={[styles.warning, { color: colors.danger }]}>
            {formError}
          </AppText>
        ) : null}

        <PrimaryButton
          title="ساخت هشدار"
          onPress={handleCreate}
          loading={createMutation.isPending}
          style={styles.createButton}
        />
      </Card>

      {/* --------------------------- لیست هشدارها --------------------------- */}
      <Card style={styles.section}>
        <AppText style={[styles.sectionTitle, { color: colors.goldSoft }]}>
          هشدارهای شما
        </AppText>

        {listError ? (
          <AppText style={[styles.warning, { color: colors.danger }]}>
            {listError}
          </AppText>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={colors.gold} />
        ) : (alerts ?? []).length === 0 ? (
          <AppText style={[styles.empty, { color: colors.textMuted }]}>
            هنوز هشداری نساخته‌اید
          </AppText>
        ) : (
          (alerts ?? []).map((alert: PriceAlert) => (
            <View
              key={alert.id}
              style={[styles.alertRow, { borderBottomColor: colors.border }]}
            >
              <View style={styles.alertInfo}>
                <AppText style={styles.alertLabel}>
                  {alert.direction === "below" ? "📉" : "📈"} {alert.label}
                </AppText>
                <AppText
                  style={[styles.alertTarget, { color: colors.textSecondary }]}
                >
                  {alert.direction === "below" ? "پایین‌تر از" : "بالاتر از"}{" "}
                  {formatToman(alert.targetPrice)} تومان
                </AppText>
                {alert.triggeredAt ? (
                  <AppText style={[styles.alertMeta, { color: colors.success }]}>
                    ✓ شلیک شد در {formatJalaliDateTime(alert.triggeredAt)}
                    {alert.triggeredPrice
                      ? ` — ${formatToman(alert.triggeredPrice)} تومان`
                      : ""}
                  </AppText>
                ) : (
                  <AppText style={[styles.alertMeta, { color: colors.textMuted }]}>
                    قیمت فعلی: {formatToman(alert.currentPrice)} تومان
                  </AppText>
                )}
              </View>

              <View style={styles.alertActions}>
                <Pressable
                  onPress={() => toggleMutation.mutate(alert)}
                  style={[
                    styles.smallButton,
                    {
                      borderColor: alert.isActive ? colors.success : colors.border,
                    },
                  ]}
                >
                  <AppText
                    style={[
                      styles.smallButtonText,
                      {
                        color: alert.isActive ? colors.success : colors.textMuted,
                      },
                    ]}
                  >
                    {alert.isActive ? "فعال" : "غیرفعال"}
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(alert)}
                  style={[styles.smallButton, { borderColor: colors.danger }]}
                >
                  <AppText
                    style={[styles.smallButtonText, { color: colors.danger }]}
                  >
                    حذف
                  </AppText>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    input: {
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      color: colors.textPrimary,
      paddingHorizontal: spacing.md,
      textAlign: "right",
      fontSize: 15,
    },
  });

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  backRow: { alignItems: "flex-end", marginBottom: spacing.sm },
  back: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "800", textAlign: "right" },
  subtitle: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  section: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    textAlign: "right",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  assetChips: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  currentPrice: { fontSize: 11, textAlign: "right", marginTop: spacing.xs },
  directionRow: { flexDirection: "row-reverse", gap: spacing.xs },
  directionOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  preview: { fontSize: 11, textAlign: "right", marginTop: 4 },
  warning: { fontSize: 12, textAlign: "right", marginTop: spacing.sm },
  createButton: { marginTop: spacing.md },
  empty: { fontSize: 13, textAlign: "center", paddingVertical: spacing.md },
  alertRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  alertInfo: { flex: 1, alignItems: "flex-end" },
  alertLabel: { fontSize: 14, fontWeight: "600" },
  alertTarget: { fontSize: 12, marginTop: 2 },
  alertMeta: { fontSize: 11, marginTop: 2 },
  alertActions: { gap: spacing.xs },
  smallButton: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minWidth: 62,
    alignItems: "center",
  },
  smallButtonText: { fontSize: 11, fontWeight: "700" },
});
