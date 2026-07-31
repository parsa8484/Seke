import React from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "../context/ThemeContext";
import { radius, spacing } from "../theme/colors";
import { formatToman, formatTomanShort, formatUsd } from "../utils/format";
import { HoldingItem } from "../api/types";

interface Props {
  item: HoldingItem;
  quantity: string; // مقدار خام تایپ‌شده توسط کاربر (رشته، برای ادیت راحت‌تر)
  onChangeQuantity: (assetKey: string, value: string) => void;
  // نرخ دلار به تومان — اگه داده بشه، معادل دلاری قیمت هم زیرش نشون داده می‌شه
  // (برای رمزارزها که مرجع جهانی‌شون دلاره)
  usdRate?: number | null;
}

export function AssetRow({
  item,
  quantity,
  onChangeQuantity,
  usdRate,
}: Props) {
  const { colors } = useTheme();
  const numericQty = Number(quantity) || 0;
  const value = numericQty * (item.price ?? 0);
  const hasPrice = item.price !== null && item.price !== undefined;

  const usdPrice =
    hasPrice && usdRate && usdRate > 0 ? (item.price as number) / usdRate : null;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <AppText style={styles.label}>{item.label}</AppText>
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
      </View>

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
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600" },
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
});
