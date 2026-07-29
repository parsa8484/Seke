import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const holdingsRouter = Router();
holdingsRouter.use(requireAuth);

// خروجی اصلی داشبورد: هر دارایی فعال + تعداد کاربر (اگر ثبت کرده) + قیمت آنلاین
// + ارزش ریالی، به‌همراه جمع کل دارایی کاربر (محاسبه‌ی نقدشوندگی آنی).
holdingsRouter.get("/summary", async (req: AuthedRequest, res) => {
  const userId = req.userId!;

  const [assets, holdings] = await Promise.all([
    prisma.asset.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.holding.findMany({ where: { userId } }),
  ]);

  const qtyByAssetId = new Map(holdings.map((h) => [h.assetId, h.quantity]));

  let total = 0;
  const items = assets.map((asset) => {
    const quantity = qtyByAssetId.get(asset.id) ?? 0;
    const price = asset.currentPrice ?? 0;
    const value = quantity * price;
    total += value;
    return {
      assetKey: asset.key,
      category: asset.category,
      label: asset.label,
      unit: asset.unit,
      quantity,
      price: asset.currentPrice,
      priceUpdatedAt: asset.priceUpdatedAt,
      value,
    };
  });

  res.json({ items, total });
});

const upsertSchema = z.object({
  items: z
    .array(
      z.object({
        assetKey: z.string().min(1),
        quantity: z.number().min(0).max(1_000_000),
      })
    )
    .min(1)
    .max(200),
});

// ذخیره‌ی دسته‌جمعی تعداد دارایی‌های کاربر (وقتی روی «ذخیره» می‌زنه)
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
    items.map((item) =>
      prisma.holding.upsert({
        where: {
          userId_assetId: {
            userId,
            assetId: assetIdByKey.get(item.assetKey)!,
          },
        },
        create: {
          userId,
          assetId: assetIdByKey.get(item.assetKey)!,
          quantity: item.quantity,
        },
        update: { quantity: item.quantity },
      })
    )
  );

  res.json({ ok: true });
});
