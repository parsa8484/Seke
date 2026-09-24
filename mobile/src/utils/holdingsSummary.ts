import { CatalogAsset, HoldingItem, HoldingsSummary } from "../api/types";
import { LocalHoldings } from "../storage/holdings";

/**
 * ساختِ همان خروجی‌ای که قبلاً `GET /api/holdings/summary` می‌داد، ولی روی
 * گوشی: کاتالوگ و قیمت از سرور، تعداد و قیمت خرید از حافظه‌ی دستگاه.
 *
 * شکل خروجی عمداً مو‌به‌مو همان `HoldingsSummary` قبلی است تا رندر داشبورد
 * دست‌نخورده بماند.
 */
export function buildHoldingsSummary(
  assets: CatalogAsset[],
  holdings: LocalHoldings
): HoldingsSummary {
  let total = 0;
  // فقط دارایی‌هایی که قیمت خرید دارند وارد محاسبه‌ی سود می‌شوند، وگرنه
  // «سود کل» گمراه‌کننده می‌شود (انگار بقیه را مجانی گرفته).
  let totalCost = 0;
  let totalValueWithCost = 0;

  const items: HoldingItem[] = assets.map((asset) => {
    const holding = holdings[asset.key];
    const quantity = holding?.quantity ?? 0;
    const avgBuyPrice = holding?.avgBuyPrice ?? null;
    const price = asset.currentPrice ?? 0;
    const value = quantity * price;
    total += value;

    let cost: number | null = null;
    let profit: number | null = null;
    let profitPercent: number | null = null;

    if (avgBuyPrice !== null && avgBuyPrice > 0 && quantity > 0) {
      cost = avgBuyPrice * quantity;
      profit = value - cost;
      profitPercent = cost > 0 ? (profit / cost) * 100 : null;
      totalCost += cost;
      totalValueWithCost += value;
    }

    return {
      assetKey: asset.key,
      category: asset.category,
      label: asset.label,
      unit: asset.unit,
      quantity,
      avgBuyPrice,
      price: asset.currentPrice,
      priceUpdatedAt: asset.priceUpdatedAt,
      value,
      cost,
      profit,
      profitPercent,
    };
  });

  const totalProfit = totalCost > 0 ? totalValueWithCost - totalCost : null;

  return {
    items,
    total,
    totalCost: totalCost > 0 ? totalCost : null,
    totalProfit,
    totalProfitPercent:
      totalCost > 0 && totalProfit !== null
        ? (totalProfit / totalCost) * 100
        : null,
  };
}
