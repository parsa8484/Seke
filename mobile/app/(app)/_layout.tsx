import React from "react";
import { Redirect, Tabs } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { useTheme } from "../../src/context/ThemeContext";

export default function AppLayout() {
  const { token, isLoading, isAdmin } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  // کاربر لاگین نکرده - بفرستش به صفحه‌ی ورود
  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "دارایی‌ها",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "مدیریت",
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "تنظیمات",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-sharp" color={color} size={size} />
          ),
        }}
      />
      {/* زیرصفحه‌های امنیت از داخل تنظیمات باز می‌شن، نه از تب‌بار */}
      <Tabs.Screen name="security" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
