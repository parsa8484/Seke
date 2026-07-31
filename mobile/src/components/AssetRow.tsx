import React from "react";
import { View, StyleSheet, TextInput, Pressable } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "../context/ThemeContext";
import { radius, spacing } from "../theme/colors";
import {
  formatToman,
  formatTomanShort,
  formatUsd,
  formatPercent,
  formatSignedToman,
} from "../utils/format";
import { HoldingItem } from "../api/types";

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
}

export function AssetRow({
  item,
  quantity,
  buyPrice,
  onChangeQuantity,
  onChangeBuyPrice,
  onPressChart,
  usdRate,
}: Props) {
  const { colors } = useTheme();
  const numericQty = Number(quantity) || 0;
  const numericBuy = Number(buyPrice) || 0;
  const value = numericQty * (item.price ?? 0);
  const hasPrice = item.price !== null && item.price !== undefined;

  const usdPrice =
    hasPrice && usdRate && usdRate > 0 ? (item.price as number) / usdRate : null;

  // سود/زیان زنده حساب می‌شه (نه از سرور) تا همون لحظه‌ای که کاربر عدد رو
  // عوض می‌کنه نتیجه رو ببینه، بدون نیاز به ذخیره.
  const showProfit = numericQty > 0 && numericBuy > 0 && hasPrice;
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

  return (
    <View style={[styles.wrapper, { borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <Pressable
          style={styles.info}
          onPress={() => onPressChart?.(item.assetKey)}
        >
          <View style={styles.labelRow}>
            {onPressChart ? (
              <AppText style={[styles.chartIcon, { color: colors.gold }]}>
                📈
              </AppText>
            ) : null}
            <AppText style={styles.label}>{item.label}</AppText>
          </View>
          <AppText
            style={[
              styles.price,
              { color: hasPrice ? colors.textSecondary : colors.textMuted },
            ]}
          >
            {hasPrice
              ? `${formatToman(item.price)} تومان`
              : "قیمت هنوز دریافت نشده"}
          </AppText>
          {usdPrice !== null ? (
            <AppText style={[styles.usdPrice, { color: colors.textMuted }]}>
              ${formatUsd(usdPrice)}
            </AppText>
          ) : null}
        </Pressable>

        <TextInput
          value={quantity}
          onChangeText={(v) => onChangeQuantity(item.assetKey, v)}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.qtyInput,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: numericQty > 0 ? colors.gold : colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
        <AppText style={[styles.unit, { color: colors.textMuted }]}>
          {item.unit}
        </AppText>

        <View style={styles.valueBox}>
          <AppText style={[styles.valueText, { color: colors.goldSoft }]}>
            {value > 0 ? formatTomanShort(value) : "—"}
          </AppText>
        </View>
      </View>

      {/* ردیف قیمت خرید فقط وقتی کاربر تعدادی وارد کرده معنی داره */}
      {numericQty > 0 ? (
        <View style={styles.buyRow}>
          <AppText style={[styles.buyLabel, { color: colors.textMuted }]}>
            قیمت خرید هر {item.unit}:
          </AppText>
          <TextInput
            value={buyPrice}
            onChangeText={(v) => onChangeBuyPrice(item.assetKey, v)}
            keyboardType="decimal-pad"
            placeholder="ثبت نشده"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.buyInput,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: numericBuy > 0 ? colors.border : colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          {showProfit ? (
            <AppText style={[styles.profitText, { color: profitColor }]}>
              {formatSignedToman(profit)} ({formatPercent(profitPercent)})
            </AppText>
          ) : (
            <AppText style={[styles.profitHint, { color: colors.textMuted }]}>
              برای دیدن سود/زیان
            </AppText>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderBottomWidth: 1, paddingBottom: spacing.xs },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  info: { flex: 1 },
  labelRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  label: { fontSize: 14, fontWeight: "600" },
  chartIcon: { fontSize: 12 },
  price: { fontSize: 12, marginTop: 2 },
  usdPrice: { fontSize: 11, marginTop: 1 },
  qtyInput: {
    width: 64,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 15,
  },
  unit: { width: 34, fontSize: 11, textAlign: "center" },
  valueBox: { minWidth: 78, alignItems: "flex-end" },
  valueText: { fontSize: 13, fontWeight: "700" },
  buyRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  buyLabel: { fontSize: 11 },
  buyInput: {
    width: 96,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 12,
  },
  profitText: { flex: 1, fontSize: 11, fontWeight: "700", textAlign: "left" },
  profitHint: { flex: 1, fontSize: 10, textAlign: "left" },
});
