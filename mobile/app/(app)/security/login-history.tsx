import React from "react";
import { StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppText } from "../../../src/components/AppText";
import { Card } from "../../../src/components/Card";
import { LoginHistoryList } from "../../../src/components/LoginHistoryList";
import { useTheme } from "../../../src/context/ThemeContext";
import { fetchLoginHistory } from "../../../src/api/auth";
import { extractErrorMessage } from "../../../src/api/client";
import { spacing } from "../../../src/theme/colors";

export default function LoginHistoryScreen() {
  const { colors } = useTheme();
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["login-history"],
    queryFn: fetchLoginHistory,
  });

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.gold}
        />
      }
    >
      <Card>
        <AppText style={[styles.hint, { color: colors.textSecondary }]}>
          ۳۰ ورود اخیر به حساب شما. اگر ورودی را نمی‌شناسید، حتماً رمز عبورتان را
          تغییر دهید.
        </AppText>

        {isLoading ? (
          <AppText style={{ color: colors.textMuted }}>در حال بارگذاری...</AppText>
        ) : error ? (
          <AppText style={{ color: colors.danger }}>
            {extractErrorMessage(error)}
          </AppText>
        ) : (
          <LoginHistoryList events={data ?? []} />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.md },
  hint: {
    fontSize: 13,
    textAlign: "right",
    marginBottom: spacing.md,
    lineHeight: 20,
  },
});
