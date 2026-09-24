import React, { useMemo } from "react";
import { View, StyleSheet, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { useTheme } from "../context/ThemeContext";
import { AppColors, radius, spacing } from "../theme/colors";
import {
  formatToman,
  formatTomanShort,
  formatUsd,
  formatPercent,
  formatSignedToman,
} from "../utils/format";
import { HoldingItem } from "../api/types";
import { bubbleTone, IntrinsicPrice } from "../utils/intrinsic";

interface Props {
  item: HoldingItem;
  quantity: string; // مقدار خام تایپ‌شده توسط کاربر (رشته، برای ادیت راحت‌تر)
  buyPrice: string; // قیمت خرید هر واحد، خام
  onChangeQuantity: (assetKey: string, value: string) => void;
  onChangeBuyPrice: (assetKey: string, value: string) => void;
  onPressChart?: (assetKey: string) => void;
  // نرخ دلار به تومان — اگه داده بشه، معادل دلاری قیمت هم زیرش نشون داده می‌شه
  // (برای رمزارزها که مرجع جهانی‌شون دلاره)
  usdRate?: number | null;
  // قیمت محاسباتی از انس جهانی و دلار — فقط طلای ۱۸ عیار و نقره‌ی ۹۹۹
  intrinsic?: IntrinsicPrice | null;
}

export function AssetRow({
  item,
  quantity,
  buyPrice,
  onChangeQuantity,
  onChangeBuyPrice,
  onPressChart,
  usdRate,
  intrinsic,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const numericQty = Number(quantity) || 0;
  const numericBuy = Number(buyPrice) || 0;
  const value = numericQty * (item.price ?? 0);
  const hasPrice = item.price !== null && item.price !== undefined;
  const owned = numericQty > 0;

  const usdPrice =
    hasPrice && usdRate && usdRate > 0 ? (item.price as number) / usdRate : null;

  // سود/زیان زنده حساب می‌شه (نه از سرور) تا همون لحظه‌ای که کاربر عدد رو
  // عوض می‌کنه نتیجه رو ببینه، بدون نیاز به ذخیره.
  const showProfit = owned && numericBuy > 0 && hasPrice;
  const cost = numericBuy * numericQty;
  const profit = showProfit ? value - cost : null;
  const profitPercent = showProfit && cost > 0 ? (profit! / cost) * 100 : null;
  const profitColor =
    profit === null
      ? colors.textMuted
      : profit > 0
      ? colors.success
      : profit < 0
      ? colors.danger
      : colors.textMuted;

  const tone = intrinsic ? bubbleTone(intrinsic) : null;
  const bubbleColor =
    tone === "over"
      ? colors.success
      : tone === "under"
      ? colors.danger
      : colors.textMuted;

  return (
    <View
      style={[
        styles.wrapper,
        owned && { borderColor: colors.gold, backgroundColor: colors.surfaceElevated },
      ]}
    >
      {/* ---------------------------- سرِ ردیف ---------------------------- */}
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <AppText style={styles.label} numberOfLines={1}>
            {item.label}
          </AppText>
          <AppText
            style={[
              styles.price,
              { color: hasPrice ? colors.textSecondary : colors.textMuted },
            ]}
          >
            {hasPrice
              ? `${formatToman(item.price)} تومان / ${item.unit}`
              : "قیمت هنوز دریافت نشده"}
            {usdPrice !== null ? `  ·  $${formatUsd(usdPrice)}` : ""}
          </AppText>
        </View>

        {onPressChart ? (
          <Pressable
            onPress={() => onPressChart(item.assetKey)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.chartButton,
              pressed && { backgroundColor: colors.gold },
            ]}
          >
            <Ionicons name="stats-chart" size={15} color={colors.gold} />
          </Pressable>
        ) : null}
      </View>

      {/* ------------------- قیمت محاسباتی و حباب -------------------
          فقط برای طلای ۱۸ عیار و نقره: قیمت جهانی (انس × دلار) در برابر قیمت
          بازار داخلی، تا معلوم شود چقدر از آن حباب است. */}
      {intrinsic ? (
        <View style={[styles.intrinsic, { borderColor: colors.border }]}>
          <View style={styles.intrinsicRow}>
            <AppText style={styles.intrinsicLabel}>قیمت محاسباتی</AppText>
            <AppText
              style={[styles.intrinsicValue, { color: colors.textSecondary }]}
            >
              {formatToman(intrinsic.computed)} تومان
            </AppText>
          </View>
          <View style={styles.intrinsicRow}>
            <AppText style={styles.intrinsicLabel}>حباب</AppText>
            <AppText style={[styles.intrinsicValue, { color: bubbleColor }]}>
              {formatSignedToman(intrinsic.bubble)} (
              {formatPercent(intrinsic.bubblePercent)})
            </AppText>
          </View>
          <AppText style={styles.intrinsicHint}>
            {intrinsic.ounceLabel} ${formatUsd(intrinsic.ounce)} × دلار{" "}
            {formatToman(intrinsic.usd)}
          </AppText>
        </View>
      ) : null}

      {/* ------------------------- فیلدهای ورودی -------------------------
          هر دو فیلد همیشه رندر می‌شن و عرضشون برابره، تا ستون‌ها در همه‌ی
          ردیف‌ها دقیقاً زیر هم بیفتن (قبلاً با نمایش شرطی، ردیف‌ها ناهم‌تراز
          می‌شدن). */}
      <View style={styles.fieldsRow}>
        <View style={styles.field}>
          <AppText style={styles.fieldLabel}>تعداد ({item.unit})</AppText>
          <TextInput
            value={quantity}
            onChangeText={(v) => onChangeQuantity(item.assetKey, v)}
            keyboardType="decimal-pad"
            placeholder="۰"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { borderColor: owned ? colors.gold : colors.border },
            ]}
          />
        </View>

        <View style={styles.field}>
          <AppText style={styles.fieldLabel}>قیمت خرید هر واحد</AppText>
          <TextInput
            value={buyPrice}
            onChangeText={(v) => onChangeBuyPrice(item.assetKey, v)}
            keyboardType="decimal-pad"
            placeholder="ثبت نشده"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { borderColor: numericBuy > 0 ? colors.goldSoft : colors.border },
            ]}
          />
        </View>
      </View>

      {/* -------------------------- ارزش و سود --------------------------- */}
      <View style={styles.footer}>
        <View style={styles.footerCell}>
          <AppText style={styles.footerLabel}>ارزش</AppText>
          <AppText
            style={[
              styles.footerValue,
              { color: value > 0 ? colors.goldSoft : colors.textMuted },
            ]}
          >
            {value > 0 ? `${formatTomanShort(value)} تومان` : "—"}
          </AppText>
        </View>

        <View style={styles.footerCell}>
          <AppText style={styles.footerLabel}>سود / زیان</AppText>
          {showProfit ? (
            <AppText style={[styles.footerValue, { color: profitColor }]}>
              {formatSignedToman(profit)} ({formatPercent(profitPercent)})
            </AppText>
          ) : (
            <AppText style={[styles.footerValue, { color: colors.textMuted }]}>
              —
            </AppText>
          )}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    wrapper: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.sm + 2,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: spacing.sm,
    },
    titleBlock: { flex: 1, alignItems: "flex-end" },
    label: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
    price: { fontSize: 11, marginTop: 3, textAlign: "right" },
    chartButton: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    intrinsic: {
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      gap: 3,
    },
    intrinsicRow: {
      flexDirection: "row-reverse",
      justifyContent: "space-between",
      alignItems: "center",
    },
    intrinsicLabel: { fontSize: 10, color: colors.textMuted },
    intrinsicValue: { fontSize: 12, fontWeight: "700" },
    intrinsicHint: {
      fontSize: 9,
      color: colors.textMuted,
      textAlign: "right",
      marginTop: 1,
    },
    fieldsRow: { flexDirection: "row-reverse", gap: spacing.sm },
    field: { flex: 1 },
    fieldLabel: {
      fontSize: 10,
      color: colors.textMuted,
      textAlign: "right",
      marginBottom: 3,
    },
    input: {
      height: 38,
      borderRadius: radius.sm,
      borderWidth: 1,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      textAlign: "center",
      fontSize: 14,
      paddingHorizontal: spacing.xs,
    },
    footer: {
      flexDirection: "row-reverse",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.xs + 2,
    },
    footerCell: { flex: 1, alignItems: "flex-end" },
    footerLabel: { fontSize: 10, color: colors.textMuted },
    footerValue: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  });
