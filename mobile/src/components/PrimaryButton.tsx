import React from "react";
import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "../theme/colors";

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "danger";
  style?: ViewStyle;
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  style,
}: Props) {
  const isOutline = variant === "outline";
  const isDanger = variant === "danger";
  const tint = isDanger ? colors.danger : colors.gold;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isDanger
          ? { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.danger }
          : isOutline
          ? styles.outline
          : styles.solid,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline || isDanger ? tint : colors.background} />
      ) : (
        <AppText
          style={[
            styles.label,
            isOutline || isDanger ? { color: tint } : styles.labelSolid,
          ]}
        >
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  solid: {
    backgroundColor: colors.gold,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
  labelSolid: {
    color: "#141A26",
  },
  labelOutline: {
    color: colors.gold,
  },
});
