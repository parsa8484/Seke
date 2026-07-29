import React from "react";
import { Text, TextProps, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

// یک Text پیش‌فرض راست‌چین برای کل اپ (چون اپ فقط فارسیه و RTL نیتیو
// را عمداً فعال نکردیم تا از پیچیدگی‌ها و ری‌استارت لازم برای toggle
// اون جلوگیری کنیم؛ به‌جاش تک‌تک متن‌ها را راست‌چین می‌کنیم)
export function AppText({ style, ...props }: TextProps) {
  return <Text style={[styles.base, style]} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    color: colors.textPrimary,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
