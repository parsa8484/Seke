import React from "react";
import { View, StyleSheet } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "../context/ThemeContext";
import { spacing, radius } from "../theme/colors";
import { formatDateTime, formatRelativeTime } from "../utils/format";
import { LoginEvent } from "../api/types";

// User-Agent خام برای کاربر بی‌معنیه — به یک اسم دستگاه خوانا تبدیلش می‌کنیم
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "دستگاه نامشخص";
  const ua = userAgent.toLowerCase();
  if (ua.includes("okhttp") || ua.includes("android")) return "اپ اندروید";
  if (ua.includes("darwin") || ua.includes("iphone") || ua.includes("ios"))
    return "اپ آیفون";
  if (ua.includes("chrome")) return "مرورگر کروم";
  if (ua.includes("firefox")) return "مرورگر فایرفاکس";
  if (ua.includes("safari")) return "مرورگر سافاری";
  if (ua.includes("curl") || ua.includes("axios")) return "ابزار خط فرمان";
  return "دستگاه نامشخص";
}

export function LoginHistoryList({ events }: { events: LoginEvent[] }) {
  const { colors } = useTheme();

  if (events.length === 0) {
    return (
      <AppText style={[styles.empty, { color: colors.textMuted }]}>
        هنوز ورودی ثبت نشده است.
      </AppText>
    );
  }

  return (
    <View style={styles.list}>
      {events.map((ev) => (
        <View
          key={ev.id}
          style={[styles.row, { borderColor: colors.border }]}
        >
          <View style={styles.rowMain}>
            <AppText style={styles.device}>{describeDevice(ev.userAgent)}</AppText>
            <AppText style={[styles.meta, { color: colors.textMuted }]}>
              {formatDateTime(ev.createdAt)} · {formatRelativeTime(ev.createdAt)}
            </AppText>
            {ev.ipAddress ? (
              <AppText style={[styles.meta, { color: colors.textMuted }]}>
                IP: {ev.ipAddress}
              </AppText>
            ) : null}
          </View>
          <View
            style={[
              styles.badge,
              {
                borderColor: ev.success ? colors.success : colors.danger,
              },
            ]}
          >
            <AppText
              style={[
                styles.badgeText,
                { color: ev.success ? colors.success : colors.danger },
              ]}
            >
              {ev.success ? "موفق" : "ناموفق"}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  rowMain: { flex: 1, alignItems: "flex-end" },
  device: { fontSize: 14, fontWeight: "600" },
  meta: { fontSize: 11, marginTop: 2 },
  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  empty: { textAlign: "right", fontSize: 13 },
});
