import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { radius, spacing } from "../theme/colors";

export function Card({ style, ...props }: ViewProps) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        // در تم روشن کارت‌ها بدون سایه گم می‌شن چون هم‌رنگ پس‌زمینه‌ان
        !isDark && styles.lightShadow,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  lightShadow: {
    shadowColor: "#8A7A55",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});
