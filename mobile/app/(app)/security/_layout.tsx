import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "../../../src/context/ThemeContext";

export default function SecurityLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="change-password"
        options={{ title: "تغییر رمز عبور" }}
      />
      <Stack.Screen
        name="login-history"
        options={{ title: "تاریخچه‌ی ورود" }}
      />
      <Stack.Screen name="profile" options={{ title: "ویرایش پروفایل" }} />
    </Stack>
  );
}
