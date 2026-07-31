import "react-native-reanimated";
import React from "react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../src/context/AuthContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import { View, StyleSheet } from "react-native";

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
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ThemedShell />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
