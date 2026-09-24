import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAssets } from "../api/prices";
import { useAuth } from "../context/AuthContext";
import {
  LocalHoldings,
  loadHoldings,
  writeLocalHoldings,
} from "../storage/holdings";
import { buildHoldingsSummary } from "../utils/holdingsSummary";

export const ASSETS_QUERY_KEY = ["assets"];

export const localHoldingsKey = (userId?: string | null) => [
  "local-holdings",
  userId ?? null,
];

/**
 * دارایی‌های کاربر، از ترکیب دو منبع جدا:
 *  - کاتالوگ و قیمت‌ها از سرور (عمومی، بدون داده‌ی شخصی)
 *  - تعداد و قیمت خرید از حافظه‌ی همین دستگاه
 *
 * جدا بودنشان عمدی است: قیمت‌ها مدام تازه می‌شوند ولی دارایی‌ها فقط وقتی
 * کاربر تایپ می‌کند، و هیچ‌کدام دیگری را دوباره از شبکه نمی‌کشد.
 */
export function useHoldings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const assetsQuery = useQuery({
    queryKey: ASSETS_QUERY_KEY,
    queryFn: fetchAssets,
    staleTime: 60_000,
  });

  const holdingsQuery = useQuery({
    queryKey: localHoldingsKey(user?.id),
    // خواندن از دیسک است، نه شبکه؛ کهنه نمی‌شود چون تنها نویسنده‌اش خود اپ است
    queryFn: () => loadHoldings(user!.id),
    enabled: Boolean(user),
    staleTime: Infinity,
  });

  const summary = useMemo(
    () => buildHoldingsSummary(assetsQuery.data ?? [], holdingsQuery.data ?? {}),
    [assetsQuery.data, holdingsQuery.data]
  );

  const save = useCallback(
    async (next: LocalHoldings) => {
      if (!user) return;
      // اول کش تا صفحه فوراً عدد تازه را نشان دهد، بعد دیسک
      queryClient.setQueryData(localHoldingsKey(user.id), next);
      await writeLocalHoldings(user.id, next);
    },
    [queryClient, user]
  );

  return {
    summary,
    items: summary.items,
    holdings: holdingsQuery.data ?? {},
    save,
    isLoading: assetsQuery.isLoading || holdingsQuery.isLoading,
    isRefetching: assetsQuery.isRefetching,
    refetch: assetsQuery.refetch,
    error: assetsQuery.error,
    /** هم کاتالوگ آمده هم حافظه‌ی محلی خوانده شده */
    ready: Boolean(assetsQuery.data) && Boolean(holdingsQuery.data),
  };
}
