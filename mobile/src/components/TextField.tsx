import React, { useState } from "react";
import { TextInput, View, StyleSheet, TextInputProps } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "../context/ThemeContext";
import { radius, spacing } from "../theme/colors";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, style, ...props }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
    ? colors.gold
    : colors.border;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <AppText style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor,
            color: colors.textPrimary,
          },
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error ? (
        <AppText style={[styles.helperText, { color: colors.danger }]}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText style={[styles.helperText, { color: colors.textMuted }]}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: 13, marginBottom: spacing.xs },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    textAlign: "right",
    writingDirection: "rtl",
    fontSize: 15,
  },
  helperText: { fontSize: 12, marginTop: spacing.xs },
});
