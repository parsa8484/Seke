import { Router } from "express";
import { z } from "zod";
import {
  MARKET_CATEGORY_LABELS,
  MARKET_CATEGORY_ORDER,
  TGJU_CATALOG,
  findSymbol,
} from "../services/tgjuCatalog";
import {
  fetchTgjuHistory,
  getMarketSnapshot,
  getSnapshotAge,
} from "../services/tgjuClient";

export const marketRouter = Router();

// لیست کامل قیمت‌های بازار از tgju — عمومی، بدون نیاز به لاگین.
// این چیزیه که تب «قیمت‌ها» توی اپ نشون می‌ده.
marketRouter.get("/", async (_req, res) => {
  try {
    const quotes = await getMarketSnapshot();

    const items = TGJU_CATALOG.map((meta) => {
      const quote = quotes.get(meta.symbol);
      return {
        symbol: meta.symbol,
        label: meta.label,
        category: meta.category,
        unit: meta.unit,
        price: quote?.price ?? null,
        high: quote?.high ?? null,
        low: quote?.low ?? null,
        change: quote?.change ?? null,
        changePercent: quote?.changePercent ?? null,
        direction: quote?.direction ?? "",
        updatedAt: quote?.updatedAt ?? null,
      };
    }).filter((i) => i.price !== null);

    res.json({
      items,
      categories: MARKET_CATEGORY_ORDER.map((key) => ({
        key,
        label: MARKET_CATEGORY_LABELS[key],
      })),
      fetchedAgoMs: getSnapshotAge(),
    });
  } catch (err) {
    res.status(503).json({
      error: "دریافت قیمت‌ها از tgju ممکن نشد. کمی بعد دوباره تلاش کنید",
    });
  }
});

const historyQuerySchema = z.object({
  days: z.coerce.number().int().min(2).max(365).default(30),
});

// تاریخچه‌ی روزانه‌ی یک نماد برای نمودار روند
marketRouter.get("/history/:symbol", async (req, res) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  const days = parsed.success ? parsed.data.days : 30;
  const symbol = req.params.symbol;

  try {
    const points = await fetchTgjuHistory(symbol, days);
    if (points.length === 0) {
      return res.status(404).json({ error: "تاریخچه‌ای برای این نماد پیدا نشد" });
    }
    // tgju جدیدترین روز رو اول می‌ده؛ برای نمودار برعکسش می‌کنیم (قدیم → جدید)
    res.json({
      symbol,
      label: findSymbol(symbol)?.label ?? symbol,
      unit: findSymbol(symbol)?.unit ?? "toman",
      points: points.slice().reverse(),
    });
  } catch (err) {
    res
      .status(503)
      .json({ error: "دریافت تاریخچه از tgju ممکن نشد" });
  }
});
