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
  fetchTgjuSymbols,
} from "../../../../src/api/admin";
import { extractErrorMessage } from "../../../../src/api/client";
import { spacing, radius } from "../../../../src/theme/colors";
import { useTheme } from "../../../../src/context/ThemeContext";
import type { AppColors } from "../../../../src/theme/colors";
import {
  AssetSourceType,
  AdminAsset,
  MarketUnit,
  TgjuSymbolOption,
} from "../../../../src/api/types";
import { formatToman } from "../../../../src/utils/format";

// BrsApi حذف شد — اندپوینتش از کار افتاد و همه‌ی قیمت‌ها از tgju می‌آید
const SOURCE_OPTIONS: { value: AssetSourceType; label: string; hint: string }[] = [
  {
    value: "tgju",
    label: "tgju",
    hint: "نماد را از فهرست پایین انتخاب کنید تا قیمت خودکار به‌روز شود",
  },
  { value: "manual", label: "دستی", hint: "قیمت رو خودت پایین‌تر وارد می‌کنی" },
];

export default function AdminAssetEditScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
  const [priceUnit, setPriceUnit] = useState<MarketUnit | null>(null);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // فهرست نمادهای tgju با قیمت لحظه‌ای — انتخاب از لیست خیلی امن‌تر از
  // تایپ دستیه، چون نماد اشتباه یعنی قیمت غلطِ باورپذیر.
  const { data: symbols } = useQuery({
    queryKey: ["admin-tgju-symbols"],
    queryFn: fetchTgjuSymbols,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (existing) {
      setKey(existing.key);
      setCategory(existing.category);
      setLabel(existing.label);
      setUnit(existing.unit);
      setSourceType(existing.sourceType);
      setSourceRef(existing.sourceRef ?? "");
      setPriceUnit(existing.priceUnit ?? null);
      setPriceInput(existing.currentPrice ? String(existing.currentPrice) : "");
    }
  }, [existing]);

  const symbolMatches: TgjuSymbolOption[] = (symbols ?? [])
    .filter((s: TgjuSymbolOption) => {
      const q = symbolSearch.trim();
      if (!q) return true;
      return s.label.includes(q) || s.symbol.toLowerCase().includes(q.toLowerCase());
    })
    .slice(0, 40);

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
        priceUnit: sourceType === "tgju" ? priceUnit : null,
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

      {sourceType === "tgju" ? (
        <>
          <TextField
            label="نماد tgju (Source Ref)"
            placeholder="retail_sekee"
            value={sourceRef}
            onChangeText={setSourceRef}
            autoCapitalize="none"
          />
          <TextField
            label="جستجوی نماد"
            placeholder="سکه، دلار، کهربا، بیت‌کوین..."
            value={symbolSearch}
            onChangeText={setSymbolSearch}
          />
          <ScrollView style={styles.symbolList} nestedScrollEnabled>
            {symbolMatches.map((s: TgjuSymbolOption) => {
              const active = sourceRef === s.symbol;
              return (
                <Pressable
                  key={s.symbol}
                  onPress={() => {
                    setSourceRef(s.symbol);
                    setPriceUnit(s.unit);
                    if (!label.trim()) setLabel(s.label);
                  }}
                  style={[
                    styles.symbolRow,
                    active && styles.symbolRowActive,
                  ]}
                >
                  <View style={styles.symbolInfo}>
                    <AppText style={styles.symbolLabel}>{s.label}</AppText>
                    <AppText style={styles.symbolCode}>
                      {s.symbol} · {s.categoryLabel}
                    </AppText>
                  </View>
                  <AppText style={styles.symbolPrice}>
                    {s.price === null
                      ? "—"
                      : s.unit === "usd"
                      ? `$${s.price}`
                      : formatToman(s.price)}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* واحد عدد خام منبع. اشتباه بودنش بی‌صداست: عدد دلاری تقسیم بر ۱۰
              هم باورپذیر به‌نظر می‌رسه. انتخاب از لیست بالا خودکار پرش می‌کنه. */}
          <AppText style={styles.sectionLabel}>واحد قیمت منبع</AppText>
          <View style={styles.sourceRow}>
            {(
              [
                { value: "toman", label: "ریالی (÷۱۰)" },
                { value: "usd", label: "دلاری" },
                { value: "point", label: "شاخص" },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setPriceUnit(opt.value)}
                style={[
                  styles.sourceOption,
                  priceUnit === opt.value && styles.sourceOptionActive,
                ]}
              >
                <AppText
                  style={[
                    styles.sourceOptionText,
                    priceUnit === opt.value && styles.sourceOptionTextActive,
                  ]}
                >
                  {opt.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </>
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

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
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
  symbolList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  symbolRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  symbolRowActive: { backgroundColor: colors.surfaceElevated },
  symbolInfo: { flex: 1, alignItems: "flex-end" },
  symbolLabel: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  symbolCode: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  symbolPrice: { fontSize: 12, color: colors.goldSoft, fontWeight: "700" },
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
