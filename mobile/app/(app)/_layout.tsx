import React, { useEffect, useRef } from "react";
import { Redirect, Tabs, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { useTheme } from "../../src/context/ThemeContext";

export default function AppLayout() {
  const { token, isLoading, isAdmin } = useAuth();
  const { colors } = useTheme();

  // زدن روی نوتیفیکیشنِ هشدار قیمت باید صفحه‌ی هشدارها را باز کند. بدون این،
  // نوتیف فقط اپ را باز می‌کرد و کاربر همان‌جایی می‌ماند که قبلاً بود — با
  // اینکه سرور از اول assetKey را در data می‌فرستاد.
  // useLastNotificationResponse هم حالتِ «اپ بسته بود» را پوشش می‌دهد هم
  // «اپ در پس‌زمینه بود»، پس به دو لیسنر جدا نیازی نیست.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledNotificationRef = useRef<string | null>(null);

  useEffect(() => {
    // تا وقتی توکن نیامده، تب‌ها هنوز mount نشده‌اند و ناوبری جایی نمی‌رود
    if (!lastResponse || !token || isLoading) return;
    const id = lastResponse.notification.request.identifier;
    if (handledNotificationRef.current === id) return;
    handledNotificationRef.current = id;
    router.push("/(app)/alerts");
  }, [lastResponse, token, isLoading]);

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
      {/* ترتیب تب‌ها = ترتیب همین تعریف‌ها. «قیمت‌ها» عمداً اول است. */}
      <Tabs.Screen
        name="market"
        options={{
          title: "قیمت‌ها",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" color={color} size={size} />
          ),
        }}
      />
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
      {/* هشدارها از داشبورد و تنظیمات باز می‌شه */}
      <Tabs.Screen name="alerts" options={{ href: null }} />
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
