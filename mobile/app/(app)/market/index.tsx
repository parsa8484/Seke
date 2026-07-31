import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

/** حالت‌های مرتب‌سازی. «دسته‌بندی» حالت پیش‌فرض است و لیست را تیتربندی می‌کند. */
type SortMode = "category" | "gainers" | "losers" | "price" | "name";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "category", label: "دسته‌بندی" },
  { key: "gainers", label: "بیشترین رشد" },
  { key: "losers", label: "بیشترین افت" },
  { key: "price", label: "گران‌ترین" },
  { key: "name", label: "الفبا" },
];

function priceText(item: MarketItem): string {
  if (item.unit === "usd") return `$${formatUsd(item.price)}`;
  if (item.unit === "point") return formatToman(item.price);
  return `${formatToman(item.price)} تومان`;
}

/**
 * درصد تغییر با علامت درست.
 * tgju جهت را در `dt` می‌دهد ("high"/"low") و `dp` را همیشه مثبت می‌فرستد،
 * پس بدون این تابع، مرتب‌سازی «بیشترین رشد» ریزش‌ها را هم بالا می‌آورد.
 */
function signedChange(item: MarketItem): number {
  const raw = Math.abs(item.changePercent ?? 0);
  if (raw === 0) return 0;
  if (item.direction === "low") return -raw;
  if (item.direction === "high") return raw;
  return item.changePercent ?? 0;
}

function MarketRow({ item, colors }: { item: MarketItem; colors: AppColors }) {
  const change = signedChange(item);
  const flat = change === 0;
  const up = change > 0;
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
        <AppText style={styles.rowLabel} numberOfLines={1}>
          {item.label}
        </AppText>
        <AppText style={[styles.rowSymbol, { color: colors.textMuted }]}>
          {item.symbol}
        </AppText>
      </View>

      <View style={styles.rowValues}>
        <AppText style={[styles.rowPrice, { color: colors.textPrimary }]}>
          {priceText(item)}
        </AppText>
        <View
          style={[
            styles.changeBadge,
            { backgroundColor: flat ? "transparent" : `${changeColor}22` },
          ]}
        >
          {!flat ? (
            <Ionicons
              name={up ? "caret-up" : "caret-down"}
              size={10}
              color={changeColor}
            />
          ) : null}
          <AppText style={[styles.rowChange, { color: changeColor }]}>
            {flat ? "بدون تغییر" : formatPercent(change)}
          </AppText>
        </View>
      </View>

      <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

type ListRow =
  | { type: "header"; key: string; label: string; count: number }
  | { type: "item"; key: string; item: MarketItem };

export default function MarketScreen() {
  const { colors } = useTheme();
  const styles2 = useMemo(() => makeStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [sort, setSort] = useState<SortMode>("category");

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["market"],
    queryFn: fetchMarket,
    // قیمت‌ها روی سرور یک دقیقه کش می‌شن؛ اینجا هم همون ریتم
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const categories: { key: string; label: string }[] = useMemo(
    () => [{ key: ALL, label: "همه" }, ...(data?.categories ?? [])],
    [data]
  );

  const filtered = useMemo(() => {
    const items: MarketItem[] = data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items.filter((item: MarketItem) => {
      if (category !== ALL && item.category !== category) return false;
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q)
      );
    });
  }, [data, search, category]);

  // مرتب‌سازی و — در حالت «دسته‌بندی» — تیتربندی.
  // قبلاً لیست دقیقاً به ترتیب خام کاتالوگ سرور می‌آمد و بی‌نظم دیده می‌شد.
  const rows = useMemo<ListRow[]>(() => {
    const sortWithin = (list: MarketItem[]) => {
      const copy = list.slice();
      switch (sort) {
        case "gainers":
          return copy.sort((a, b) => signedChange(b) - signedChange(a));
        case "losers":
          return copy.sort((a, b) => signedChange(a) - signedChange(b));
        case "price":
          return copy.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        case "name":
          return copy.sort((a, b) => a.label.localeCompare(b.label, "fa"));
        default:
          // داخل هر دسته، گران‌ترین‌ها بالا — خواناتر از ترتیب خام کاتالوگ
          return copy.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      }
    };

    if (sort !== "category") {
      return sortWithin(filtered).map((item) => ({
        type: "item" as const,
        key: item.symbol,
        item,
      }));
    }

    const out: ListRow[] = [];
    for (const cat of categories) {
      if (cat.key === ALL) continue;
      const group = filtered.filter((i) => i.category === cat.key);
      if (group.length === 0) continue;
      out.push({
        type: "header",
        key: `h_${cat.key}`,
        label: cat.label,
        count: group.length,
      });
      for (const item of sortWithin(group)) {
        out.push({ type: "item", key: item.symbol, item });
      }
    }
    // دسته‌هایی که سرور در فهرست دسته‌ها نداده (نماد جدید) هم نباید گم شوند
    const known = new Set(categories.map((c) => c.key));
    const orphans = filtered.filter((i) => !known.has(i.category));
    if (orphans.length > 0) {
      out.push({
        type: "header",
        key: "h_other",
        label: "سایر",
        count: orphans.length,
      });
      for (const item of sortWithin(orphans)) {
        out.push({ type: "item", key: item.symbol, item });
      }
    }
    return out;
  }, [filtered, categories, sort]);

  const lastUpdate = useMemo(() => {
    const items: MarketItem[] = data?.items ?? [];
    const times = items
      .map((i: MarketItem) => i.updatedAt)
      .filter(Boolean) as string[];
    return times.sort().pop() ?? null;
  }, [data]);

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

      <View style={styles2.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="جستجو: دلار، سکه، نقره، بیت‌کوین..."
          placeholderTextColor={colors.textMuted}
          style={styles2.search}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/*
        قبلاً این دو ردیف داخل ScrollView افقیِ row-reverse بودند — همان
        باگی که در چیپ‌های صفحه‌ی هشدارها هم بود: اسکرول همیشه از x=0 شروع
        می‌شود، ولی row-reverse آیتم اول را در انتهای محتوا (سمت راست)
        می‌گذارد، پس دقیقاً همان آیتمی که باید بدون اسکرول دیده شود، بیرون
        از دید می‌افتد. تعداد گزینه‌ها کم است، پس به‌جای اسکرول از چیدمانِ
        چندسطری استفاده می‌شود.
      */}
      <View style={styles.chips}>
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
      </View>

      <View style={styles.sortRow}>
        <AppText style={[styles.sortLabel, { color: colors.textMuted }]}>
          مرتب‌سازی:
        </AppText>
        {SORT_OPTIONS.map((opt) => {
          const active = sort === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSort(opt.key)}
              style={[
                styles.sortChip,
                {
                  backgroundColor: active ? colors.gold : "transparent",
                  borderColor: active ? colors.gold : colors.border,
                },
              ]}
            >
              <AppText
                style={[
                  styles.sortChipText,
                  { color: active ? colors.background : colors.textSecondary },
                ]}
              >
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <AppText style={[styles.errorText, { color: colors.danger }]}>
          {extractErrorMessage(error)}
        </AppText>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item: row }) =>
          row.type === "header" ? (
            <View
              style={[
                styles.sectionHeader,
                {
                  backgroundColor: colors.surface,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <AppText
                style={[styles.sectionTitle, { color: colors.goldSoft }]}
              >
                {row.label}
              </AppText>
              <AppText
                style={[styles.sectionCount, { color: colors.textMuted }]}
              >
                {formatToman(row.count)} نماد
              </AppText>
            </View>
          ) : (
            <MarketRow item={row.item} colors={colors} />
          )
        }
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
    searchWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      height: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
    },
    search: {
      flex: 1,
      height: "100%",
      color: colors.textPrimary,
      textAlign: "right",
      fontSize: 14,
      padding: 0,
    },
  });

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
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
    paddingTop: spacing.sm,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  sortRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  sortLabel: { fontSize: 11 },
  sortChip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  sortChipText: { fontSize: 11, fontWeight: "700" },
  listContent: { paddingBottom: spacing.xl },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: 13, fontWeight: "800" },
  sectionCount: { fontSize: 10 },
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
  rowValues: { alignItems: "flex-start", minWidth: 128 },
  rowPrice: { fontSize: 14, fontWeight: "700" },
  changeBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 2,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 3,
  },
  rowChange: { fontSize: 11, fontWeight: "600" },
  errorText: {
    textAlign: "center",
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyText: { textAlign: "center", marginTop: spacing.xl, fontSize: 13 },
});
