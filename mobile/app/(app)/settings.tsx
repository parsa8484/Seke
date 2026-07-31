import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { AppText } from "../../src/components/AppText";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import {
  useTheme,
  ThemePreference,
} from "../../src/context/ThemeContext";
import { useLock } from "../../src/context/LockContext";
import { spacing, radius } from "../../src/theme/colors";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "light", label: "روشن", icon: "☀️" },
  { value: "dark", label: "تیره", icon: "🌙" },
  { value: "system", label: "خودکار", icon: "📱" },
];

function SettingsLink({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.linkRow, { borderColor: colors.border }]}
    >
      <AppText style={[styles.chevron, { color: colors.textMuted }]}>‹</AppText>
      <AppText style={styles.linkLabel}>
        {icon}  {label}
      </AppText>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, signOut, hasRememberedSession, forgetDevice } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const { isEnabled, setEnabled, support, methodLabel } = useLock();
  const [lockError, setLockError] = useState<string | null>(null);

  async function handleToggleLock(next: boolean) {
    setLockError(null);
    if (support === "not-enrolled") {
      setLockError(
        `روی این گوشی هنوز ${methodLabel} ثبت نشده. اول از تنظیمات گوشی اضافه‌اش کنید.`
      );
      return;
    }
    if (support === "unsupported") {
      setLockError("این گوشی از احراز هویت بیومتریک پشتیبانی نمی‌کند");
      return;
    }
    const ok = await setEnabled(next);
    if (!ok) setLockError("تأیید هویت انجام نشد، تنظیمات تغییر نکرد");
  }

  async function doLogout(forget: boolean) {
    if (forget) await forgetDevice();
    await signOut();
    router.replace("/(auth)/login");
  }

  function handleLogout() {
    // بعد از خروج، «ورود با اثر انگشت» همچنان کار می‌کند مگر اینکه کاربر
    // صریحاً بخواهد این دستگاه فراموش شود (مثلاً گوشی را واگذار می‌کند).
    if (!hasRememberedSession) return doLogout(false);
    Alert.alert(
      "خروج از حساب",
      "ورود سریع با اثر انگشت روی این گوشی باقی بماند؟",
      [
        { text: "انصراف", style: "cancel" },
        { text: "بله، باقی بماند", onPress: () => doLogout(false) },
        {
          text: "نه، حذف شود",
          style: "destructive",
          onPress: () => doLogout(true),
        },
      ]
    );
  }

  const initial = (user?.displayName || user?.username || "؟")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
      <AppText style={styles.title}>تنظیمات</AppText>

      <Card style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={styles.profileInfo}>
            <AppText style={styles.name}>
              {user?.displayName || user?.username || "کاربر گرامی"}
            </AppText>
            {user?.username ? (
              <AppText style={[styles.meta, { color: colors.textSecondary }]}>
                @{user.username}
              </AppText>
            ) : null}
            <AppText style={[styles.meta, { color: colors.textMuted }]}>
              {user?.email}
            </AppText>
          </View>
          <View style={[styles.avatar, { backgroundColor: colors.gold }]}>
            <AppText style={[styles.avatarText, { color: colors.background }]}>
              {initial}
            </AppText>
          </View>
        </View>

        {user?.role === "admin" ? (
          <View style={[styles.adminBadge, { borderColor: colors.gold }]}>
            <AppText style={[styles.adminBadgeText, { color: colors.gold }]}>
              ⭐ مدیر سیستم
            </AppText>
          </View>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <AppText style={[styles.sectionTitle, { color: colors.goldSoft }]}>
          حساب و امنیت
        </AppText>
        <SettingsLink
          icon="👤"
          label="ویرایش پروفایل"
          onPress={() => router.push("/(app)/security/profile")}
        />
        <SettingsLink
          icon="🔑"
          label="تغییر رمز عبور"
          onPress={() => router.push("/(app)/security/change-password")}
        />
        <SettingsLink
          icon="🕘"
          label="تاریخچه‌ی ورود"
          onPress={() => router.push("/(app)/security/login-history")}
        />
        <SettingsLink
          icon="🔔"
          label="هشدارهای قیمت"
          onPress={() => router.push("/(app)/alerts")}
        />

        <View style={styles.switchRow}>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleLock}
            trackColor={{ true: colors.gold, false: colors.border }}
            thumbColor={colors.surface}
          />
          <View style={styles.switchLabelBox}>
            <AppText style={styles.linkLabel}>
              🔐  قفل با {methodLabel}
            </AppText>
            <AppText style={[styles.switchHint, { color: colors.textMuted }]}>
              {support === "available"
                ? "هر بار باز شدن اپ، تأیید هویت لازم است"
                : support === "not-enrolled"
                ? `${methodLabel} روی گوشی ثبت نشده`
                : "این گوشی پشتیبانی نمی‌کند"}
            </AppText>
          </View>
        </View>
        {lockError ? (
          <AppText style={[styles.lockError, { color: colors.danger }]}>
            {lockError}
          </AppText>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <AppText style={[styles.sectionTitle, { color: colors.goldSoft }]}>
          ظاهر برنامه
        </AppText>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setPreference(opt.value)}
                style={[
                  styles.themeOption,
                  {
                    borderColor: active ? colors.gold : colors.border,
                    backgroundColor: active
                      ? colors.surfaceElevated
                      : "transparent",
                  },
                ]}
              >
                <AppText style={styles.themeIcon}>{opt.icon}</AppText>
                <AppText
                  style={[
                    styles.themeLabel,
                    { color: active ? colors.gold : colors.textSecondary },
                  ]}
                >
                  {opt.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText style={[styles.hint, { color: colors.textMuted }]}>
          «خودکار» از تنظیمات خود گوشی پیروی می‌کند
        </AppText>
      </Card>

      <PrimaryButton
        title="خروج از حساب کاربری"
        onPress={handleLogout}
        variant="outline"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: spacing.md,
  },
  profileCard: { marginBottom: spacing.md },
  profileRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
  },
  profileInfo: { flex: 1, alignItems: "flex-end" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "800" },
  name: { fontSize: 17, fontWeight: "700" },
  meta: { fontSize: 13, marginTop: 2 },
  adminBadge: {
    alignSelf: "flex-end",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  adminBadgeText: { fontSize: 12, fontWeight: "700" },
  section: { marginBottom: spacing.md },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingVertical: spacing.sm + 2,
  },
  linkLabel: { fontSize: 14, flex: 1 },
  chevron: { fontSize: 22, paddingHorizontal: spacing.xs },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  switchLabelBox: { flex: 1, alignItems: "flex-end" },
  switchHint: { fontSize: 11, marginTop: 2, textAlign: "right" },
  lockError: { fontSize: 11, textAlign: "right", paddingBottom: spacing.sm },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: spacing.sm,
    textAlign: "right",
  },
  themeRow: { flexDirection: "row-reverse", gap: spacing.sm },
  themeOption: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  themeIcon: { fontSize: 20 },
  themeLabel: { fontSize: 13, fontWeight: "600" },
  hint: { fontSize: 11, marginTop: spacing.sm, textAlign: "right" },
});
