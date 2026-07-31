import React from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../../../src/components/AppText";
import { PrimaryButton } from "../../../../src/components/PrimaryButton";
import { fetchAdminAssets } from "../../../../src/api/admin";
import { extractErrorMessage } from "../../../../src/api/client";
import { spacing, radius } from "../../../../src/theme/colors";
import { useTheme } from "../../../../src/context/ThemeContext";
import type { AppColors } from "../../../../src/theme/colors";
import { formatToman } from "../../../../src/utils/format";
import { AdminAsset } from "../../../../src/api/types";

const SOURCE_LABEL: Record<string, string> = {
  tgju: "tgju",
  brsapi: "BrsApi",
  manual: "دستی",
};

export default function AdminAssetsScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["admin-assets"],
    queryFn: fetchAdminAssets,
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
    <View style={styles.flex}>
      <FlatList
        contentContainerStyle={styles.container}
        data={data}
        keyExtractor={(a) => a.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />
        }
        renderItem={({ item }: { item: AdminAsset }) => (
          <Pressable
            onPress={() => router.push(`/(app)/admin/assets/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
            <View style={styles.rowInfo}>
              <AppText style={styles.label}>{item.label}</AppText>
              <AppText style={styles.meta}>
                {SOURCE_LABEL[item.sourceType]} ·{" "}
                {item.currentPrice != null
                  ? `${formatToman(item.currentPrice)} تومان`
                  : "بدون قیمت"}
              </AppText>
            </View>
            {!item.isActive ? (
              <View style={styles.badge}>
                <AppText style={styles.badgeText}>غیرفعال</AppText>
              </View>
            ) : null}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
      />
      <View style={styles.footer}>
        <PrimaryButton
          title="افزودن دارایی جدید"
          onPress={() => router.push("/(app)/admin/assets/new")}
        />
      </View>
    </View>
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
  container: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  label: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#141A26" },
  divider: { height: 1, backgroundColor: colors.border },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
