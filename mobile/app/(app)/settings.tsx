import React from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { AppText } from "../../src/components/AppText";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import {
  useTheme,
  ThemePreference,
} from "../../src/context/ThemeContext";
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
  const { user, signOut } = useAuth();
  const { colors, preference, setPreference } = useTheme();

  async function handleLogout() {
    await signOut();
    router.replace("/(auth)/login");
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
