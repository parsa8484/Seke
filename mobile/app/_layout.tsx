import "react-native-reanimated";
import React from "react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import { LockProvider, useLock } from "../src/context/LockContext";
import { LockScreen } from "../src/components/LockScreen";
import { View, StyleSheet, ActivityIndicator } from "react-native";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// جدا شده چون useTheme فقط داخل ThemeProvider قابل استفاده‌ست
function ThemedShell() {
  const { colors, isDark } = useTheme();
  const { isLocked, isLoading } = useLock();

  return (
    // بدون این SafeAreaView، هدرِ صفحه‌ها می‌رفت زیر نوار وضعیت/ناچ گوشی.
    // لبه‌ی پایین عمداً حذف شده چون تب‌بار خودش inset پایین را اعمال می‌کند.
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : isLocked ? (
        // در حالت قفل، درخت اپ اصلاً رندر نمی‌شه — نه فقط پوشانده می‌شه
        <LockScreen />
      ) : (
        <Slot />
      )}
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LockProvider>
            <AuthProvider>
              <ThemedShell />
            </AuthProvider>
          </LockProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
