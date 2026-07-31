import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { useTheme } from "../../../src/context/ThemeContext";

// حتی اگه تب ادمین برای کاربر عادی مخفیه، این گارد جلوی دسترسی مستقیم به
// مسیرهای زیرمجموعه‌ی /admin رو هم می‌گیره
export default function AdminLayout() {
  const { isAdmin } = useAuth();
  const { colors } = useTheme();

  if (!isAdmin) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "پنل مدیریت" }} />
      <Stack.Screen name="users/index" options={{ title: "کاربران" }} />
      <Stack.Screen name="users/[id]" options={{ title: "جزئیات کاربر" }} />
      <Stack.Screen name="assets/index" options={{ title: "دارایی‌ها" }} />
      <Stack.Screen name="assets/[id]" options={{ title: "ویرایش دارایی" }} />
    </Stack>
  );
}
