import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { fetchTgjuDailyRows } from "../services/tgjuClient";
import { MarketUnit, toStoredPrice, unitForSymbol } from "../services/tgjuCatalog";

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

const historyQuerySchema = z.object({
  days: z.coerce.number().int().min(2).max(365).default(30),
});

/**
 * روند ارزش کل پرتفوی برای نمودار.
 *
 * معنی دقیق عددها: «اگر همین تعداد دارایی که الان داری را در آن روز داشتی،
 * چقدر می‌ارزید». چون جدول تراکنش (خرید/فروش با تاریخ) نداریم، تعداد فعلی در
 * قیمت تاریخی هر روز ضرب می‌شود. مزیتش این است که کاربر از همان روز اول چند
 * سال داده‌ی واقعی می‌بیند، به‌جای اینکه منتظر پر شدن یک جدول snapshot بماند.
 *
 * قیمت‌های روزانه از همان تاریخچه‌ی tgju می‌آید که نمودار تک‌دارایی استفاده
 * می‌کند (کش ۳۰ دقیقه‌ای مشترک). دارایی‌هایی که تاریخچه ندارند (دستی یا خطای
 * شبکه) با قیمت فعلی‌شان ثابت در نظر گرفته و در `missingHistory` گزارش می‌شوند
 * تا اپ بتواند به کاربر بگوید نمودار کامل نیست.
 */
holdingsRouter.get("/history", async (req: AuthedRequest, res) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  const days = parsed.success ? parsed.data.days : 30;
  const userId = req.userId!;

  const holdings = await prisma.holding.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: { asset: true },
  });

  if (holdings.length === 0) {
    return res.json({ days, points: [], assetCount: 0, missingHistory: [] });
  }

  // تاریخ شمسیِ آماده‌ی هر روز را از هر نمادی که داشته باشد برمی‌داریم تا
  // اپ لازم نباشد دوباره میلادی→شمسی حساب کند.
  const jdateByDate = new Map<string, string>();

  const series = await Promise.all(
    holdings.map(async (holding) => {
      const { asset, quantity } = holding;
      const base = {
        label: asset.label,
        quantity,
        currentPrice: asset.currentPrice ?? 0,
        dates: [] as string[],
        prices: [] as number[],
      };
      if (asset.sourceType !== "tgju" || !asset.sourceRef) return base;

      try {
        // واحدِ صریحِ ادمین بر کاتالوگ اولویت دارد — دقیقاً مثل priceService
        const unit =
          (asset.priceUnit as MarketUnit | null) ?? unitForSymbol(asset.sourceRef);
        const rows = await fetchTgjuDailyRows(asset.sourceRef);
        const recent = rows.slice(0, days).reverse(); // قدیم → جدید
        for (const row of recent) {
          if (row.jdate) jdateByDate.set(row.date, row.jdate);
        }
        return {
          ...base,
          dates: recent.map((r) => r.date),
          prices: recent.map((r) => toStoredPrice(r.close, unit)),
        };
      } catch {
        return base;
      }
    })
  );

  const missingHistory = series.filter((s) => s.dates.length === 0).map((s) => s.label);

  // محور زمان = اجتماع روزهای همه‌ی دارایی‌ها (هر نماد ممکن است روزهای
  // تعطیل متفاوتی داشته باشد)، آخرین `days` روز.
  const axis = [...new Set(series.flatMap((s) => s.dates))].sort().slice(-days);

  if (axis.length < 2) {
    return res.json({
      days,
      points: [],
      assetCount: holdings.length,
      missingHistory,
    });
  }

  // برای هر دارایی یک اشاره‌گر نگه می‌داریم و همراه محور جلو می‌رود؛ اگر آن
  // روز قیمتی ثبت نشده، آخرین قیمت شناخته‌شده ادامه پیدا می‌کند.
  const cursors = series.map(() => 0);
  const points = axis.map((date) => {
    let value = 0;
    series.forEach((s, i) => {
      if (s.dates.length === 0) {
        value += s.quantity * s.currentPrice;
        return;
      }
      let index = cursors[i];
      while (index + 1 < s.dates.length && s.dates[index + 1] <= date) index++;
      cursors[i] = index;
      value += s.quantity * s.prices[index];
    });
    return { date, jdate: jdateByDate.get(date) ?? null, price: value };
  });

  res.json({ days, points, assetCount: holdings.length, missingHistory });
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
