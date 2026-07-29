import React from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { AppText } from "../../src/components/AppText";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import { colors, spacing } from "../../src/theme/colors";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.container}>
      <AppText style={styles.title}>تنظیمات</AppText>

      <Card style={styles.profileCard}>
        <AppText style={styles.name}>
          {user?.displayName || "کاربر گرامی"}
        </AppText>
        <AppText style={styles.email}>{user?.email}</AppText>
      </Card>

      <PrimaryButton
        title="خروج از حساب کاربری"
        onPress={handleLogout}
        variant="outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: spacing.md,
  },
  profileCard: { alignItems: "flex-end", marginBottom: spacing.lg },
  name: { fontSize: 17, fontWeight: "700" },
  email: { color: colors.textSecondary, marginTop: spacing.xs },
});
