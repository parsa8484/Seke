import React from "react";
import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "../context/ThemeContext";
import { radius, spacing } from "../theme/colors";

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
  const { colors } = useTheme();
  const isOutline = variant === "outline";
  const isDanger = variant === "danger";
  const tint = isDanger ? colors.danger : colors.gold;

  const variantStyle: ViewStyle =
    isDanger || isOutline
      ? { backgroundColor: "transparent", borderWidth: 1.5, borderColor: tint }
      : { backgroundColor: colors.gold };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={isOutline || isDanger ? tint : colors.background}
        />
      ) : (
        <AppText
          style={[
            styles.label,
            { color: isOutline || isDanger ? tint : colors.background },
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
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { fontSize: 16, fontWeight: "700" },
});
