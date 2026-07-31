import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { AppText } from "./AppText";
import { PrimaryButton } from "./PrimaryButton";
import { useTheme } from "../context/ThemeContext";
import { useLock } from "../context/LockContext";
import { spacing } from "../theme/colors";

/**
 * صفحه‌ای که جای کل اپ می‌نشیند تا کاربر با اثر انگشت/چهره تأیید هویت کند.
 * محتوای اپ اصلاً رندر نمی‌شود، پس در حالت قفل حتی از سوییچر اپ‌ها هم
 * اطلاعات مالی دیده نمی‌شود.
 */
export function LockScreen() {
  const { colors } = useTheme();
  const { unlock, methodLabel } = useLock();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function attempt() {
    setBusy(true);
    const ok = await unlock();
    setBusy(false);
    setFailed(!ok);
  }

  // یک بار خودکار موقع باز شدن — کاربر نباید برای هر بار باز کردن اپ
  // یک دکمه‌ی اضافه بزند
  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppText style={styles.emoji}>🔒</AppText>
      <AppText style={[styles.title, { color: colors.textPrimary }]}>
        دارایار قفل است
      </AppText>
      <AppText style={[styles.subtitle, { color: colors.textSecondary }]}>
        برای دیدن دارایی‌هایتان با {methodLabel} وارد شوید
      </AppText>

      {failed ? (
        <AppText style={[styles.failed, { color: colors.danger }]}>
          تأیید هویت انجام نشد
        </AppText>
      ) : null}

      <PrimaryButton
        title={`باز کردن با ${methodLabel}`}
        onPress={attempt}
        loading={busy}
        style={styles.button}
      />
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
  emoji: { fontSize: 56 },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  failed: { fontSize: 13, marginTop: spacing.xs },
  button: { alignSelf: "stretch", marginTop: spacing.lg },
});
