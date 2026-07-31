import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { useTheme } from "../context/ThemeContext";
import { useLock } from "../context/LockContext";
import { radius, spacing } from "../theme/colors";

/**
 * صفحه‌ای که جای کل اپ می‌نشیند تا کاربر با اثر انگشت/چهره تأیید هویت کند.
 * محتوای اپ اصلاً رندر نمی‌شود، پس در حالت قفل حتی از سوییچر اپ‌ها هم
 * اطلاعات مالی دیده نمی‌شود.
 *
 * عمداً خودکار پرامپت نمی‌دهد: قبلاً همین کار باعث می‌شد پنجره‌ی سیستمی پیش از
 * آماده‌شدن اکتیویتی باز شود و بی‌صدا رد شود (کاربر یک صفحه‌ی قفلِ ظاهراً
 * بی‌کار می‌دید). حالا با زدن دکمه شروع می‌شود.
 */
export function LockScreen() {
  const { colors } = useTheme();
  const { unlock, methodLabel } = useLock();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function attempt() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await unlock();
    setBusy(false);
    setFailed(!ok);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppText style={[styles.brand, { color: colors.gold }]}>دارایار</AppText>
      <AppText style={[styles.title, { color: colors.textPrimary }]}>
        اپ قفل است
      </AppText>
      <AppText style={[styles.subtitle, { color: colors.textSecondary }]}>
        برای دیدن دارایی‌هایتان با {methodLabel} وارد شوید
      </AppText>

      <Pressable
        onPress={attempt}
        disabled={busy}
        style={({ pressed }) => [
          styles.fingerButton,
          {
            borderColor: colors.gold,
            backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.gold} size="large" />
        ) : (
          <Ionicons name="finger-print" size={62} color={colors.gold} />
        )}
      </Pressable>

      <AppText style={[styles.hint, { color: colors.textMuted }]}>
        {busy ? "در حال تأیید هویت..." : `برای ورود لمس کنید`}
      </AppText>

      {failed ? (
        <AppText style={[styles.failed, { color: colors.danger }]}>
          تأیید هویت انجام نشد — دوباره تلاش کنید
        </AppText>
      ) : null}

      <Pressable onPress={attempt} disabled={busy} style={styles.textButton}>
        <AppText style={[styles.textButtonLabel, { color: colors.gold }]}>
          ورود با {methodLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  brand: { fontSize: 26, fontWeight: "800", marginBottom: spacing.xs },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  fingerButton: {
    width: 128,
    height: 128,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 12, marginTop: spacing.sm },
  failed: { fontSize: 13, marginTop: spacing.xs, textAlign: "center" },
  textButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  textButtonLabel: { fontSize: 15, fontWeight: "700" },
});
