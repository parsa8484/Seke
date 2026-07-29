import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Switch, Alert } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppText } from "../../../../src/components/AppText";
import { Card } from "../../../../src/components/Card";
import { TextField } from "../../../../src/components/TextField";
import { PrimaryButton } from "../../../../src/components/PrimaryButton";
import {
  fetchAdminAssets,
  createAdminAsset,
  updateAdminAsset,
  deleteAdminAsset,
  setAdminAssetPrice,
} from "../../../../src/api/admin";
import { extractErrorMessage } from "../../../../src/api/client";
import { colors, spacing, radius } from "../../../../src/theme/colors";
import { AssetSourceType, AdminAsset } from "../../../../src/api/types";

const SOURCE_OPTIONS: { value: AssetSourceType; label: string; hint: string }[] = [
  { value: "tgju", label: "tgju", hint: "شناسه‌ی data-market-row در tgju.org" },
  { value: "brsapi", label: "BrsApi", hint: "بخشی از نام فارسی نماد در BrsApi" },
  { value: "manual", label: "دستی", hint: "قیمت رو خودت پایین‌تر وارد می‌کنی" },
];

export default function AdminAssetEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const queryClient = useQueryClient();

  // چون endpoint تکی برای گرفتن یک asset نداریم، از لیست کش‌شده فیلتر می‌کنیم
  const { data: assets } = useQuery({
    queryKey: ["admin-assets"],
    queryFn: fetchAdminAssets,
    enabled: !isNew,
  });
  const existing = assets?.find((a: AdminAsset) => a.id === id);

  const [key, setKey] = useState("");
  const [category, setCategory] = useState("");
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("عدد");
  const [sourceType, setSourceType] = useState<AssetSourceType>("manual");
  const [sourceRef, setSourceRef] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setKey(existing.key);
      setCategory(existing.category);
      setLabel(existing.label);
      setUnit(existing.unit);
      setSourceType(existing.sourceType);
      setSourceRef(existing.sourceRef ?? "");
      setPriceInput(existing.currentPrice ? String(existing.currentPrice) : "");
    }
  }, [existing]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["admin-assets"] });
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["holdings-summary"] });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        key: key.trim(),
        category: category.trim(),
        label: label.trim(),
        unit: unit.trim() || "عدد",
        sourceType,
        sourceRef: sourceRef.trim() || undefined,
      };
      if (isNew) {
        return createAdminAsset(payload);
      }
      return updateAdminAsset(id, payload);
    },
    onSuccess: () => {
      invalidateAll();
      router.back();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const priceMutation = useMutation({
    mutationFn: () => setAdminAssetPrice(id, Number(priceInput)),
    onSuccess: () => {
      invalidateAll();
      Alert.alert("انجام شد", "قیمت به‌روزرسانی شد");
    },
    onError: (err) => Alert.alert("خطا", extractErrorMessage(err)),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (isActive: boolean) => updateAdminAsset(id, { isActive }),
    onSuccess: invalidateAll,
    onError: (err) => Alert.alert("خطا", extractErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAdminAsset(id),
    onSuccess: () => {
      invalidateAll();
      router.back();
    },
    onError: (err) => Alert.alert("خطا", extractErrorMessage(err)),
  });

  function confirmDelete() {
    Alert.alert(
      "حذف دارایی",
      "این دارایی و تعداد ثبت‌شده‌ی همه‌ی کاربران برای آن حذف می‌شود. مطمئنی؟",
      [
        { text: "انصراف", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => deleteMutation.mutate() },
      ]
    );
  }

  function handleSave() {
    setError(null);
    if (!key.trim() || !category.trim() || !label.trim()) {
      setError("کلید، دسته‌بندی و برچسب اجباری هستند");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{ title: isNew ? "دارایی جدید" : "ویرایش دارایی" }}
      />
      <TextField
        label="کلید یکتا (لاتین، بدون فاصله)"
        placeholder="مثلا silver_gram"
        value={key}
        onChangeText={(v) => setKey(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
        autoCapitalize="none"
        editable={isNew}
        style={!isNew && { opacity: 0.6 }}
      />
      <TextField
        label="دسته‌بندی"
        placeholder="coin | fund | manual | silver"
        value={category}
        onChangeText={setCategory}
        autoCapitalize="none"
      />
      <TextField
        label="برچسب نمایشی (فارسی)"
        placeholder="مثلا نقره خام (گرم)"
        value={label}
        onChangeText={setLabel}
      />
      <TextField label="واحد" placeholder="عدد / گرم / واحد" value={unit} onChangeText={setUnit} />

      <AppText style={styles.sectionLabel}>منبع قیمت</AppText>
      <View style={styles.sourceRow}>
        {SOURCE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setSourceType(opt.value)}
            style={[
              styles.sourceOption,
              sourceType === opt.value && styles.sourceOptionActive,
            ]}
          >
            <AppText
              style={[
                styles.sourceOptionText,
                sourceType === opt.value && styles.sourceOptionTextActive,
              ]}
            >
              {opt.label}
            </AppText>
          </Pressable>
        ))}
      </View>
      <AppText style={styles.hint}>
        {SOURCE_OPTIONS.find((o) => o.value === sourceType)?.hint}
      </AppText>

      {sourceType !== "manual" ? (
        <TextField
          label="Source Ref"
          placeholder={sourceType === "tgju" ? "retail_sekee" : "کهربا"}
          value={sourceRef}
          onChangeText={setSourceRef}
          autoCapitalize="none"
        />
      ) : null}

      {error ? <AppText style={styles.error}>{error}</AppText> : null}

      <PrimaryButton
        title={isNew ? "افزودن دارایی" : "ذخیره تغییرات"}
        onPress={handleSave}
        loading={saveMutation.isPending}
        style={{ marginTop: spacing.sm }}
      />

      {!isNew && existing ? (
        <>
          <Card style={styles.priceCard}>
            <AppText style={styles.sectionLabel}>تعیین قیمت دستی</AppText>
            <TextField
              placeholder="قیمت به تومان"
              keyboardType="decimal-pad"
              value={priceInput}
              onChangeText={(v) => setPriceInput(v.replace(/[^0-9.]/g, ""))}
            />
            <PrimaryButton
              title="ثبت قیمت"
              variant="outline"
              onPress={() => priceMutation.mutate()}
              loading={priceMutation.isPending}
              disabled={!priceInput}
            />
          </Card>

          <View style={styles.settingRow}>
            <Switch
              value={existing.isActive}
              onValueChange={(v) => toggleActiveMutation.mutate(v)}
              trackColor={{ true: colors.success }}
            />
            <AppText style={styles.settingLabel}>این دارایی فعال است</AppText>
          </View>

          <PrimaryButton
            title="حذف این دارایی"
            variant="danger"
            onPress={confirmDelete}
            loading={deleteMutation.isPending}
            style={{ marginTop: spacing.lg }}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: "right",
  },
  sourceRow: { flexDirection: "row-reverse", gap: spacing.sm, marginBottom: spacing.xs },
  sourceOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  sourceOptionActive: { borderColor: colors.gold, backgroundColor: colors.surfaceElevated },
  sourceOptionText: { fontSize: 13, color: colors.textSecondary },
  sourceOptionTextActive: { color: colors.gold, fontWeight: "700" },
  hint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "right",
    marginBottom: spacing.md,
  },
  error: { color: colors.danger, textAlign: "right", marginBottom: spacing.sm },
  priceCard: { marginTop: spacing.lg, alignItems: "stretch" },
  settingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  settingLabel: { fontSize: 14 },
});
