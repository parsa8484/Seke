import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const holdingsRouter = Router();
holdingsRouter.use(requireAuth);

// خروجی اصلی داشبورد: هر دارایی فعال + تعداد کاربر (اگر ثبت کرده) + قیمت آنلاین
// + ارزش ریالی + سود/زیان نسبت به قیمت خرید، به‌همراه جمع کل و سود کل.
holdingsRouter.get("/summary", async (req: AuthedRequest, res) => {
  const userId = req.userId!;

  const [assets, holdings] = await Promise.all([
    prisma.asset.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.holding.findMany({ where: { userId } }),
  ]);

  const holdingByAssetId = new Map(holdings.map((h) => [h.assetId, h]));

  let total = 0;
  // فقط دارایی‌هایی که قیمت خرید دارن وارد محاسبه‌ی سود می‌شن، وگرنه
  // «سود کل» گمراه‌کننده می‌شه (انگار بقیه رو مجانی گرفته).
  let totalCost = 0;
  let totalValueWithCost = 0;

  const items = assets.map((asset) => {
    const holding = holdingByAssetId.get(asset.id);
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

  res.json({
    items,
    total,
    totalCost: totalCost > 0 ? totalCost : null,
    totalProfit,
    totalProfitPercent:
      totalCost > 0 && totalProfit !== null ? (totalProfit / totalCost) * 100 : null,
  });
});

const upsertSchema = z.object({
  items: z
    .array(
      z.object({
        assetKey: z.string().min(1),
        quantity: z.number().min(0).max(1_000_000),
        // null یعنی «قیمت خرید ثبت نشده» و سود/زیان محاسبه نمی‌شه.
        // undefined یعنی «دست نزن» و مقدار قبلی حفظ می‌شه.
        avgBuyPrice: z
          .number()
          .min(0)
          .max(1_000_000_000_000)
          .nullable()
          .optional(),
      })
    )
    .min(1)
    .max(200),
});

// ذخیره‌ی دسته‌جمعی تعداد و قیمت خرید دارایی‌های کاربر
holdingsRouter.put("/", async (req: AuthedRequest, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const userId = req.userId!;
  const { items } = parsed.data;

  const assetKeys = items.map((i) => i.assetKey);
  const assets = await prisma.asset.findMany({
    where: { key: { in: assetKeys } },
  });
  const assetIdByKey = new Map(assets.map((a) => [a.key, a.id]));

  const unknown = items.filter((i) => !assetIdByKey.has(i.assetKey));
  if (unknown.length > 0) {
    return res.status(400).json({
      error: `دارایی نامعتبر: ${unknown.map((u) => u.assetKey).join(", ")}`,
    });
  }

  await prisma.$transaction(
    items.map((item) => {
      const assetId = assetIdByKey.get(item.assetKey)!;
      // صفر و رشته‌ی خالی از سمت اپ به null تبدیل می‌شن؛ صفرِ واقعی
      // به‌عنوان قیمت خرید معنی نداره.
      const buyPrice =
        item.avgBuyPrice === undefined
          ? undefined
          : item.avgBuyPrice && item.avgBuyPrice > 0
          ? item.avgBuyPrice
          : null;

      return prisma.holding.upsert({
        where: { userId_assetId: { userId, assetId } },
        create: {
          userId,
          assetId,
          quantity: item.quantity,
          avgBuyPrice: buyPrice ?? null,
        },
        update: {
          quantity: item.quantity,
          ...(buyPrice === undefined ? {} : { avgBuyPrice: buyPrice }),
        },
      });
    })
  );

  res.json({ ok: true });
});
