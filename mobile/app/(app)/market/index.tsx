import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { AppText } from "../../../src/components/AppText";
import { fetchMarket } from "../../../src/api/market";
import { extractErrorMessage } from "../../../src/api/client";
import { useTheme } from "../../../src/context/ThemeContext";
import { AppColors, radius, spacing } from "../../../src/theme/colors";
import {
  formatToman,
  formatUsd,
  formatPercent,
  formatRelativeTime,
} from "../../../src/utils/format";
import { MarketItem } from "../../../src/api/types";

const ALL = "__all__";

function priceText(item: MarketItem): string {
  if (item.unit === "usd") return `$${formatUsd(item.price)}`;
  if (item.unit === "point") return formatToman(item.price);
  return `${formatToman(item.price)} تومان`;
}

function MarketRow({
  item,
  colors,
}: {
  item: MarketItem;
  colors: AppColors;
}) {
  // tgju جهت تغییر رو با dt می‌ده: "high" یعنی نسبت به قبل بالا رفته.
  // وقتی خالیه (بازار بسته/بدون تغییر) از خود عدد تغییر استفاده می‌کنیم.
  const up =
    item.direction === "high" ||
    (item.direction === "" && (item.changePercent ?? 0) > 0);
  const flat = !item.changePercent;
  const changeColor = flat
    ? colors.textMuted
    : up
    ? colors.success
    : colors.danger;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(app)/market/[symbol]",
          params: { symbol: item.symbol },
        })
      }
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.surfaceElevated : "transparent",
        },
      ]}
    >
      <View style={styles.rowInfo}>
        <AppText style={styles.rowLabel}>{item.label}</AppText>
        <AppText style={[styles.rowSymbol, { color: colors.textMuted }]}>
          {item.symbol}
        </AppText>
      </View>

      <View style={styles.rowValues}>
        <AppText style={[styles.rowPrice, { color: colors.textPrimary }]}>
          {priceText(item)}
        </AppText>
        <AppText style={[styles.rowChange, { color: changeColor }]}>
          {flat ? "بدون تغییر" : `${up ? "▲" : "▼"} ${formatPercent(item.changePercent)}`}
        </AppText>
      </View>
    </Pressable>
  );
}

export default function MarketScreen() {
  const { colors } = useTheme();
  const styles2 = useMemo(() => makeStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["market"],
    queryFn: fetchMarket,
    // قیمت‌ها روی سرور یک دقیقه کش می‌شن؛ اینجا هم همون ریتم
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const filtered = useMemo(() => {
    const items: MarketItem[] = data?.items ?? [];
    const q = search.trim();
    return items.filter((item: MarketItem) => {
      if (category !== ALL && item.category !== category) return false;
      if (!q) return true;
      return (
        item.label.includes(q) ||
        item.symbol.toLowerCase().includes(q.toLowerCase())
      );
    });
  }, [data, search, category]);

  const lastUpdate = useMemo(() => {
    const items: MarketItem[] = data?.items ?? [];
    const times = items
      .map((i: MarketItem) => i.updatedAt)
      .filter(Boolean) as string[];
    return times.sort().pop() ?? null;
  }, [data]);

  const categories: { key: string; label: string }[] = [
    { key: ALL, label: "همه" },
    ...(data?.categories ?? []),
  ];

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.gold} size="large" />
        <AppText style={[styles.centerText, { color: colors.textSecondary }]}>
          در حال گرفتن قیمت‌ها از tgju...
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.headerBox}>
        <AppText style={styles.title}>قیمت‌های بازار</AppText>
        <AppText style={[styles.subtitle, { color: colors.textMuted }]}>
          منبع: tgju.org · {formatRelativeTime(lastUpdate)}
        </AppText>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="جستجو: دلار، سکه، کهربا، بیت‌کوین..."
        placeholderTextColor={colors.textMuted}
        style={styles2.search}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {categories.map((c) => {
          const active = category === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              style={[
                styles.chip,
                {
                  borderColor: active ? colors.gold : colors.border,
                  backgroundColor: active
                    ? colors.surfaceElevated
                    : "transparent",
                },
              ]}
            >
              <AppText
                style={[
                  styles.chipText,
                  { color: active ? colors.gold : colors.textSecondary },
                ]}
              >
                {c.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? (
        <AppText style={[styles.errorText, { color: colors.danger }]}>
          {extractErrorMessage(error)}
        </AppText>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.symbol}
        renderItem={({ item }) => <MarketRow item={item} colors={colors} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.gold}
          />
        }
        ListEmptyComponent={
          <AppText style={[styles.emptyText, { color: colors.textMuted }]}>
            نمادی با این جستجو پیدا نشد
          </AppText>
        }
      />
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    search: {
      marginHorizontal: spacing.md,
      height: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      paddingHorizontal: spacing.md,
      textAlign: "right",
      fontSize: 14,
    },
  });

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  centerText: { fontSize: 13 },
  headerBox: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: "flex-end",
  },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 11, marginTop: 2 },
  chips: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    flexDirection: "row-reverse",
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginLeft: spacing.xs,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  listContent: { paddingBottom: spacing.xl },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowLabel: { fontSize: 14, fontWeight: "600" },
  rowSymbol: { fontSize: 10, marginTop: 2 },
  rowValues: { alignItems: "flex-start", minWidth: 120 },
  rowPrice: { fontSize: 14, fontWeight: "700" },
  rowChange: { fontSize: 11, marginTop: 2 },
  errorText: {
    textAlign: "center",
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyText: { textAlign: "center", marginTop: spacing.xl, fontSize: 13 },
});
