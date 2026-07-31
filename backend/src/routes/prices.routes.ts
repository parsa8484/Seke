import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { fetchTgjuHistory } from "../services/tgjuClient";

export const pricesRouter = Router();

// لیست عمومی همه‌ی دارایی‌های فعال به همراه آخرین قیمت کش‌شده
// (نیازی به لاگین نداره - دقیقا مثل نسخه‌ی قبلی که قیمت‌ها عمومی نمایش داده می‌شدن)
pricesRouter.get("/", async (_req, res) => {
  const assets = await prisma.asset.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: {
      key: true,
      category: true,
      label: true,
      unit: true,
      sourceType: true,
      currentPrice: true,
      priceUpdatedAt: true,
    },
  });
  res.json({ assets });
});

const historyQuerySchema = z.object({
  days: z.coerce.number().int().min(2).max(365).default(30),
});

/**
 * روند قیمت یک دارایی برای نمودار.
 *
 * برای دارایی‌های tgju تاریخچه‌ی روزانه‌ی خود tgju را می‌گیریم (چند سال داده
 * از همان لحظه‌ی اول موجود است). برای دارایی‌های دستی از جدول محلی
 * PriceHistory استفاده می‌شود که با هر ثبت قیمت پر می‌شود.
 */
pricesRouter.get("/:key/history", async (req, res) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  const days = parsed.success ? parsed.data.days : 30;

  const asset = await prisma.asset.findUnique({
    where: { key: req.params.key },
    select: {
      id: true,
      key: true,
      label: true,
      unit: true,
      sourceType: true,
      sourceRef: true,
      currentPrice: true,
    },
  });
  if (!asset) return res.status(404).json({ error: "دارایی پیدا نشد" });

  if (asset.sourceType === "tgju" && asset.sourceRef) {
    try {
      const points = await fetchTgjuHistory(asset.sourceRef, days);
      if (points.length > 0) {
        return res.json({
          assetKey: asset.key,
          label: asset.label,
          source: "tgju",
          points: points
            .slice()
            .reverse()
            .map((p) => ({ date: p.date, jdate: p.jdate, price: p.close })),
        });
      }
    } catch {
      // به تاریخچه‌ی محلی برمی‌گردیم
    }
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.priceHistory.findMany({
    where: { assetId: asset.id, recordedAt: { gte: since } },
    orderBy: { recordedAt: "asc" },
    select: { price: true, recordedAt: true },
  });

  // PriceHistory هر ۱۵ دقیقه یک ردیف می‌سازه؛ برای نمودار روزانه فقط آخرین
  // قیمت هر روز رو نگه می‌داریم تا نمودار شلوغ نشه.
  const lastPerDay = new Map<string, { price: number; at: Date }>();
  for (const row of rows) {
    const day = row.recordedAt.toISOString().slice(0, 10);
    lastPerDay.set(day, { price: row.price, at: row.recordedAt });
  }

  res.json({
    assetKey: asset.key,
    label: asset.label,
    source: "local",
    points: [...lastPerDay.entries()].map(([date, v]) => ({
      date,
      jdate: null,
      price: v.price,
    })),
  });
});
