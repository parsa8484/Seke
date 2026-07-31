import React, { useEffect, useMemo, useState } from "react";
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
import { fetchHoldingsSummary } from "../../../src/api/holdings";
import { extractErrorMessage } from "../../../src/api/client";
import { registerForPushNotifications } from "../../../src/services/notifications";
import { useTheme } from "../../../src/context/ThemeContext";
import { AppColors, radius, spacing } from "../../../src/theme/colors";
import {
  formatToman,
  formatJalaliDateTime,
  toPersianDigits,
} from "../../../src/utils/format";
import {
  AlertDirection,
  HoldingItem,
  PriceAlert,
} from "../../../src/api/types";

export default function AlertsScreen() {
  const { colors } = useTheme();
  const styles2 = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [assetKey, setAssetKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [target, setTarget] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
  });
  const { data: summary } = useQuery({
    queryKey: ["holdings-summary"],
    queryFn: fetchHoldingsSummary,
  });

  // فقط دارایی‌هایی که قیمت آنلاین دارن قابل هشدار گذاشتنن
  const assets = useMemo<HoldingItem[]>(
    () =>
      (summary?.items ?? []).filter((i: HoldingItem) => i.price !== null),
    [summary]
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
      setAssetKey(null);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err) => setFormError(extractErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (alert: PriceAlert) =>
      updateAlert(alert.id, { isActive: !alert.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  function handleCreate() {
    if (!assetKey) return setFormError("اول دارایی را انتخاب کنید");
    const value = Number(target);
    if (!value || value <= 0) return setFormError("قیمت هدف را وارد کنید");
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
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <AppText style={[styles.back, { color: colors.gold }]}>بازگشت ›</AppText>
      </Pressable>

      <AppText style={styles.title}>هشدارهای قیمت</AppText>
      <AppText style={[styles.subtitle, { color: colors.textSecondary }]}>
        وقتی قیمت به عددی که می‌خواهید رسید، روی همین گوشی نوتیفیکیشن می‌گیرید.
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.assetChips}>
            {assets.map((a: HoldingItem) => {
              const active = assetKey === a.assetKey;
              return (
                <Pressable
                  key={a.assetKey}
                  onPress={() => setAssetKey(a.assetKey)}
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
        </ScrollView>

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
                onPress={() => setDirection(opt.value)}
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
          onChangeText={(v) => setTarget(v.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="مثلاً ۲۰۰۰۰۰۰۰۰"
          placeholderTextColor={colors.textMuted}
          style={styles2.input}
        />
        {target ? (
          <AppText style={[styles.preview, { color: colors.textMuted }]}>
            یعنی {toPersianDigits(formatToman(Number(target)))} تومان
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
  assetChips: { flexDirection: "row-reverse", gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginLeft: spacing.xs,
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
