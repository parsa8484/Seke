import React, { useMemo, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent, Pressable } from "react-native";
import Svg, {
  Path,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { AppText } from "./AppText";
import { useTheme } from "../context/ThemeContext";
import { spacing } from "../theme/colors";
import { formatToman, formatTomanShort } from "../utils/format";
import { formatTgjuJalaliShort, formatJalaliDayMonth } from "../utils/jalali";

export interface ChartPoint {
  /** تاریخ میلادی ISO — برای وقتی jdate نداریم */
  date: string;
  /** تاریخ شمسی آماده از tgju مثل "1405/05/08" */
  jdate?: string | null;
  price: number;
}

interface Props {
  points: ChartPoint[];
  height?: number;
  /** برای مقادیر دلاری/شاخصی، واحد نمایش عوض می‌شود */
  suffix?: string;
}

const PADDING_X = 8;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 22;

function labelFor(p: ChartPoint): string {
  return p.jdate ? formatTgjuJalaliShort(p.jdate) : formatJalaliDayMonth(p.date);
}

/**
 * نمودار خطی ساده روی SVG — بدون کتابخانه‌ی چارت اضافه.
 * با لمس هر نقطه، قیمت و تاریخ شمسی همان روز بالای نمودار نشان داده می‌شود.
 */
export function LineChart({ points, height = 180, suffix = "تومان" }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((p) => p.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const first = values[0];
    const last = values[values.length - 1];
    return {
      min,
      max,
      first,
      last,
      change: last - first,
      changePercent: first > 0 ? ((last - first) / first) * 100 : 0,
      // اگر همه‌ی مقادیر برابر باشند تقسیم بر صفر پیش می‌آید
      span: max - min || Math.abs(max) || 1,
    };
  }, [points]);

  if (points.length < 2 || !stats) {
    return (
      <View style={[styles.empty, { height }]}>
        <AppText style={[styles.emptyText, { color: colors.textMuted }]}>
          داده‌ی کافی برای رسم نمودار وجود ندارد
        </AppText>
      </View>
    );
  }

  const innerW = Math.max(width - PADDING_X * 2, 1);
  const innerH = height - PADDING_TOP - PADDING_BOTTOM;

  const xFor = (i: number) =>
    PADDING_X + (i / (points.length - 1)) * innerW;
  const yFor = (v: number) =>
    PADDING_TOP + innerH - ((v - stats.min) / stats.span) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(p.price)}`)
    .join(" ");

  const areaPath = `${linePath} L${xFor(points.length - 1)},${
    PADDING_TOP + innerH
  } L${xFor(0)},${PADDING_TOP + innerH} Z`;

  const rising = stats.change >= 0;
  const lineColor = rising ? colors.success : colors.danger;
  const active = activeIndex !== null ? points[activeIndex] : null;

  function handleTouch(x: number) {
    if (innerW <= 0) return;
    const ratio = Math.min(Math.max((x - PADDING_X) / innerW, 0), 1);
    setActiveIndex(Math.round(ratio * (points.length - 1)));
  }

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.header}>
        <AppText style={[styles.headerValue, { color: lineColor }]}>
          {rising ? "▲" : "▼"} {formatToman(Math.abs(stats.change))} (
          {formatToman(Math.abs(stats.changePercent))}٪)
        </AppText>
        <AppText style={[styles.headerLabel, { color: colors.textSecondary }]}>
          {active
            ? `${labelFor(active)}: ${formatToman(active.price)} ${suffix}`
            : `${formatToman(stats.last)} ${suffix}`}
        </AppText>
      </View>

      {width > 0 ? (
        <Pressable
          onPressIn={(e) => handleTouch(e.nativeEvent.locationX)}
          onTouchMove={(e) => handleTouch(e.nativeEvent.locationX)}
          onPressOut={() => setActiveIndex(null)}
        >
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={lineColor} stopOpacity="0.28" />
                <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {/* خطوط راهنمای افقی */}
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={PADDING_X}
                x2={width - PADDING_X}
                y1={PADDING_TOP + innerH * f}
                y2={PADDING_TOP + innerH * f}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="4 6"
              />
            ))}

            <Path d={areaPath} fill="url(#areaFill)" />
            <Path
              d={linePath}
              stroke={lineColor}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {active && activeIndex !== null ? (
              <>
                <Line
                  x1={xFor(activeIndex)}
                  x2={xFor(activeIndex)}
                  y1={PADDING_TOP}
                  y2={PADDING_TOP + innerH}
                  stroke={colors.textMuted}
                  strokeWidth={1}
                />
                <Circle
                  cx={xFor(activeIndex)}
                  cy={yFor(active.price)}
                  r={4.5}
                  fill={lineColor}
                  stroke={colors.background}
                  strokeWidth={2}
                />
              </>
            ) : null}
          </Svg>
        </Pressable>
      ) : (
        <View style={{ height }} />
      )}

      {/* نمودار از چپ (قدیمی‌ترین) به راست (جدیدترین) کشیده می‌شه — قرارداد
          رایج نمودارهای زمانی، حتی در رابط راست‌به‌چپ. برچسب‌ها هم همون ترتیب. */}
      <View style={styles.axis}>
        <AppText style={[styles.axisText, { color: colors.textMuted }]}>
          {labelFor(points[0])}
        </AppText>
        <AppText style={[styles.axisText, { color: colors.textMuted }]}>
          کمترین {formatTomanShort(stats.min)} · بیشترین{" "}
          {formatTomanShort(stats.max)}
        </AppText>
        <AppText style={[styles.axisText, { color: colors.textMuted }]}>
          {labelFor(points[points.length - 1])}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  headerValue: { fontSize: 13, fontWeight: "700" },
  headerLabel: { fontSize: 12 },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  axisText: { fontSize: 10 },
  empty: { alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 12 },
});
