import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { AppText } from "../../../src/components/AppText";
import { Card } from "../../../src/components/Card";
import { LineChart } from "../../../src/components/LineChart";
import { fetchMarket, fetchMarketHistory } from "../../../src/api/market";
import { extractErrorMessage } from "../../../src/api/client";
import { useTheme } from "../../../src/context/ThemeContext";
import { radius, spacing } from "../../../src/theme/colors";
import {
  formatToman,
  formatUsd,
  formatPercent,
  formatRelativeTime,
} from "../../../src/utils/format";
import { MarketHistory, MarketItem } from "../../../src/api/types";

const RANGES = [
  { days: 7, label: "۱ هفته" },
  { days: 30, label: "۱ ماه" },
  { days: 90, label: "۳ ماه" },
  { days: 365, label: "۱ سال" },
];

export default function MarketDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const { colors } = useTheme();
  const [days, setDays] = useState(30);

  const { data: market } = useQuery({
    queryKey: ["market"],
    queryFn: fetchMarket,
    staleTime: 60_000,
  });

  const item = useMemo<MarketItem | undefined>(
    () => market?.items.find((i: MarketItem) => i.symbol === symbol),
    [market, symbol]
  );

  const {
    data: history,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["market-history", symbol, days],
    queryFn: () => fetchMarketHistory(String(symbol), days),
    enabled: Boolean(symbol),
    staleTime: 10 * 60_000,
  });

  const isUsd = item?.unit === "usd";
  const suffix = isUsd ? "دلار" : item?.unit === "point" ? "واحد" : "تومان";
  const showPrice = (v: number | null | undefined) =>
    v === null || v === undefined
      ? "—"
      : isUsd
      ? `$${formatUsd(v)}`
      : `${formatToman(v)} ${suffix}`;

  const chartPoints = useMemo(() => {
    const points: MarketHistory["points"] = history?.points ?? [];
    return points.map((p) => ({
      date: p.date,
      jdate: p.jdate,
      price: p.close,
    }));
  }, [history]);

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <AppText style={[styles.back, { color: colors.gold }]}>
          بازگشت به لیست قیمت‌ها ›
        </AppText>
      </Pressable>

      <AppText style={styles.title}>{item?.label ?? history?.label ?? symbol}</AppText>
      <AppText style={[styles.symbol, { color: colors.textMuted }]}>
        {symbol}
      </AppText>

      {item ? (
        <Card style={styles.card}>
          <AppText style={[styles.bigPrice, { color: colors.gold }]}>
            {showPrice(item.price)}
          </AppText>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <AppText style={[styles.statLabel, { color: colors.textMuted }]}>
                بیشترین روز
              </AppText>
              <AppText style={styles.statValue}>{showPrice(item.high)}</AppText>
            </View>
            <View style={styles.stat}>
              <AppText style={[styles.statLabel, { color: colors.textMuted }]}>
                کمترین روز
              </AppText>
              <AppText style={styles.statValue}>{showPrice(item.low)}</AppText>
            </View>
            <View style={styles.stat}>
              <AppText style={[styles.statLabel, { color: colors.textMuted }]}>
                تغییر
              </AppText>
              <AppText
                style={[
                  styles.statValue,
                  {
                    color: !item.changePercent
                      ? colors.textMuted
                      : item.changePercent > 0
                      ? colors.success
                      : colors.danger,
                  },
                ]}
              >
                {formatPercent(item.changePercent)}
              </AppText>
            </View>
          </View>
          <AppText style={[styles.updated, { color: colors.textMuted }]}>
            آخرین به‌روزرسانی: {formatRelativeTime(item.updatedAt)}
          </AppText>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <AppText style={[styles.sectionTitle, { color: colors.goldSoft }]}>
          روند قیمت
        </AppText>

        <View style={styles.rangeRow}>
          {RANGES.map((r) => {
            const active = days === r.days;
            return (
              <Pressable
                key={r.days}
                onPress={() => setDays(r.days)}
                style={[
                  styles.rangeChip,
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
                    styles.rangeText,
                    { color: active ? colors.gold : colors.textSecondary },
                  ]}
                >
                  {r.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.chartLoading}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : error ? (
          <AppText style={[styles.errorText, { color: colors.danger }]}>
            {extractErrorMessage(error)}
          </AppText>
        ) : (
          <LineChart points={chartPoints} suffix={suffix} />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  backRow: { alignItems: "flex-end", marginBottom: spacing.sm },
  back: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "800", textAlign: "right" },
  symbol: { fontSize: 11, textAlign: "right", marginBottom: spacing.md },
  card: { marginBottom: spacing.md, alignItems: "stretch" },
  bigPrice: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  stat: { flex: 1, alignItems: "flex-end" },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  updated: { fontSize: 11, textAlign: "right", marginTop: spacing.sm },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: spacing.sm,
  },
  rangeRow: {
    flexDirection: "row-reverse",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  rangeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    alignItems: "center",
  },
  rangeText: { fontSize: 12, fontWeight: "600" },
  chartLoading: { height: 180, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 12, textAlign: "center", paddingVertical: spacing.lg },
});
