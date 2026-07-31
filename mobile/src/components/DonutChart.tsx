import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { AppText } from "./AppText";
import { useTheme } from "../context/ThemeContext";
import { chartPalette, spacing, radius } from "../theme/colors";
import { formatToman } from "../utils/format";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
}

interface Props {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
}

/**
 * نمودار حلقه‌ای ترکیب دارایی‌ها.
 * به‌جای path های پیچیده‌ی SVG از یک دایره با strokeDasharray استفاده می‌کنیم:
 * هر قطعه یک دایره‌ی کامله که فقط بخشی از محیطش رسم می‌شه و با strokeDashoffset
 * به جای درستش چرخونده می‌شه. سبک‌تر و بدون وابستگی به کتابخانه‌ی نمودار.
 */
export function DonutChart({ slices, size = 180, thickness = 26 }: Props) {
  const { colors } = useTheme();

  const { segments, total } = useMemo(() => {
    const positive = slices.filter((s) => s.value > 0);
    const sum = positive.reduce((acc, s) => acc + s.value, 0);
    if (sum <= 0) return { segments: [], total: 0 };

    let offsetRatio = 0;
    const segs = positive
      .slice()
      .sort((a, b) => b.value - a.value)
      .map((slice, index) => {
        const ratio = slice.value / sum;
        const seg = {
          ...slice,
          ratio,
          offsetRatio,
          color: chartPalette[index % chartPalette.length],
        };
        offsetRatio += ratio;
        return seg;
      });
    return { segments: segs, total: sum };
  }, [slices]);

  if (segments.length === 0) return null;

  const radiusPx = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const center = size / 2;

  return (
    <View style={styles.wrapper}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* چرخش ۹۰- درجه تا نمودار از بالا شروع بشه نه از سمت راست */}
          <G rotation={-90} origin={`${center}, ${center}`}>
            <Circle
              cx={center}
              cy={center}
              r={radiusPx}
              stroke={colors.border}
              strokeWidth={thickness}
              fill="none"
            />
            {segments.map((seg) => (
              <Circle
                key={seg.key}
                cx={center}
                cy={center}
                r={radiusPx}
                stroke={seg.color}
                strokeWidth={thickness}
                fill="none"
                strokeLinecap="butt"
                strokeDasharray={`${seg.ratio * circumference} ${circumference}`}
                strokeDashoffset={-seg.offsetRatio * circumference}
              />
            ))}
          </G>
        </Svg>
        <View style={[styles.centerLabel, { width: size, height: size }]}>
          <AppText style={[styles.centerCaption, { color: colors.textMuted }]}>
            مجموع
          </AppText>
          <AppText style={[styles.centerValue, { color: colors.gold }]}>
            {formatToman(total)}
          </AppText>
        </View>
      </View>

      <View style={styles.legend}>
        {segments.map((seg) => (
          <View key={seg.key} style={styles.legendRow}>
            <View style={styles.legendRight}>
              <AppText
                style={[styles.legendPercent, { color: colors.textPrimary }]}
              >
                {(seg.ratio * 100).toFixed(1)}٪
              </AppText>
              <AppText
                style={[styles.legendLabel, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {seg.label}
              </AppText>
            </View>
            <View style={[styles.swatch, { backgroundColor: seg.color }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center" },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  centerCaption: { fontSize: 11 },
  centerValue: { fontSize: 17, fontWeight: "800", marginTop: 2 },
  legend: { alignSelf: "stretch", marginTop: spacing.md, gap: spacing.xs },
  legendRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  legendRight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  swatch: { width: 12, height: 12, borderRadius: radius.sm / 2 },
  legendLabel: { fontSize: 13, flexShrink: 1 },
  legendPercent: { fontSize: 13, fontWeight: "700" },
});
