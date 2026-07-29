import React from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "../theme/colors";
import { formatToman, formatTomanShort } from "../utils/format";
import { HoldingItem } from "../api/types";

interface Props {
  item: HoldingItem;
  quantity: string; // مقدار خام تایپ‌شده توسط کاربر (رشته، برای ادیت راحت‌تر)
  onChangeQuantity: (assetKey: string, value: string) => void;
}

export function AssetRow({ item, quantity, onChangeQuantity }: Props) {
  const numericQty = Number(quantity) || 0;
  const value = numericQty * (item.price ?? 0);
  const hasPrice = item.price !== null && item.price !== undefined;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <AppText style={styles.label}>{item.label}</AppText>
        <AppText style={styles.price}>
          {hasPrice
            ? `${formatToman(item.price)} تومان`
            : "قیمت هنوز دریافت نشده"}
        </AppText>
      </View>

      <TextInput
        value={quantity}
        onChangeText={(v) => onChangeQuantity(item.assetKey, v)}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        style={styles.qtyInput}
      />
      <AppText style={styles.unit}>{item.unit}</AppText>

      <View style={styles.valueBox}>
        <AppText style={styles.valueText}>
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
  price: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  qtyInput: {
    width: 64,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    textAlign: "center",
    fontSize: 15,
  },
  unit: { width: 34, fontSize: 11, color: colors.textMuted, textAlign: "center" },
  valueBox: { minWidth: 78, alignItems: "flex-end" },
  valueText: { fontSize: 13, fontWeight: "700", color: colors.goldSoft },
});
