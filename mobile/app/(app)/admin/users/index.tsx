import React from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../../../src/components/AppText";
import { fetchAdminUsers } from "../../../../src/api/admin";
import { extractErrorMessage } from "../../../../src/api/client";
import { spacing, radius } from "../../../../src/theme/colors";
import { useTheme } from "../../../../src/context/ThemeContext";
import type { AppColors } from "../../../../src/theme/colors";
import { AdminUser } from "../../../../src/api/types";

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <AppText>در حال بارگذاری...</AppText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <AppText style={{ color: colors.danger }}>
          {extractErrorMessage(error)}
        </AppText>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.container}
      data={data}
      keyExtractor={(u) => u.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
      }
      renderItem={({ item }: { item: AdminUser }) => (
        <Pressable
          onPress={() => router.push(`/(app)/admin/users/${item.id}`)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
          <View style={styles.rowInfo}>
            <AppText style={styles.email}>{item.email}</AppText>
            <AppText style={styles.meta}>
              {item.displayName || "بدون نام"} · {item.holdingsCount} دارایی ثبت‌شده
            </AppText>
          </View>
          <View style={styles.badges}>
            {item.role === "admin" ? (
              <View style={[styles.badge, styles.badgeAdmin]}>
                <AppText style={styles.badgeText}>ادمین</AppText>
              </View>
            ) : null}
            {!item.isActive ? (
              <View style={[styles.badge, styles.badgeDisabled]}>
                <AppText style={styles.badgeText}>غیرفعال</AppText>
              </View>
            ) : null}
          </View>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      ListEmptyComponent={
        <AppText style={styles.empty}>هنوز کاربری ثبت‌نام نکرده</AppText>
      }
    />
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  container: { padding: spacing.md },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  email: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badges: { flexDirection: "row", gap: spacing.xs },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeAdmin: { backgroundColor: colors.gold },
  badgeDisabled: { backgroundColor: colors.danger },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#141A26" },
  divider: { height: 1, backgroundColor: colors.border },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.xl },
});
